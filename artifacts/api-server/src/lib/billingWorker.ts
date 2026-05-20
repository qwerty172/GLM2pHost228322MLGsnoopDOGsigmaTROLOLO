import { eq, and, sql, isNotNull, lte, or, isNull } from "drizzle-orm";
import {
  db,
  hostsTable,
  playersTable,
  sessionsTable,
  billingEventsTable,
} from "@workspace/db";
import { logger } from "./logger";
import { usdtToLztRound, pickPlayerBucket } from "./lzt";

const BILLING_INTERVAL_MS = 60_000;
let interval: NodeJS.Timeout | null = null;

async function billOnce(): Promise<void> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - BILLING_INTERVAL_MS);
  const eligible = await db
    .select()
    .from(sessionsTable)
    .where(
      and(
        eq(sessionsTable.status, "active"),
        isNotNull(sessionsTable.claimedByPlayerId),
        or(
          isNull(sessionsTable.lastBilledAt),
          lte(sessionsTable.lastBilledAt, cutoff),
        ),
      ),
    );

  for (const session of eligible) {
    if (!session.claimedByPlayerId) continue;
    const rateUsd = Number(session.ratePerMinute);
    if (!Number.isFinite(rateUsd) || rateUsd <= 0) continue;
    const costLzt = usdtToLztRound(rateUsd);
    if (costLzt <= 0) continue;

    // Host receives the full per-minute cost in LZT, split 50/50 between
    // their зелёный (withdrawable) and синий (internal) buckets. If costLzt
    // is odd, the leftover LZT goes to зелёный (the bucket the player can
    // actually cash out).
    const hostGreenLzt = Math.ceil(costLzt / 2);
    const hostBlueLzt = Math.floor(costLzt / 2);

    try {
      const ended = await db.transaction(async (tx) => {
        const [player] = await tx
          .select({
            green: playersTable.withdrawableBalanceLzt,
            blue: playersTable.internalBalanceLzt,
          })
          .from(playersTable)
          .where(eq(playersTable.id, session.claimedByPlayerId!));

        const bucket = pickPlayerBucket(
          session.paymentSource,
          costLzt,
          player?.green ?? 0,
          player?.blue ?? 0,
        );
        if (bucket === null) {
          await tx
            .update(sessionsTable)
            .set({ status: "ended", endedAt: now })
            .where(eq(sessionsTable.id, session.id));
          return true;
        }

        const playerCol =
          bucket === "green"
            ? playersTable.withdrawableBalanceLzt
            : playersTable.internalBalanceLzt;

        const debited = await tx
          .update(playersTable)
          .set(
            bucket === "green"
              ? {
                  withdrawableBalanceLzt: sql`${playersTable.withdrawableBalanceLzt} - ${costLzt}`,
                }
              : {
                  internalBalanceLzt: sql`${playersTable.internalBalanceLzt} - ${costLzt}`,
                },
          )
          .where(
            and(
              eq(playersTable.id, session.claimedByPlayerId!),
              sql`${playerCol} >= ${costLzt}`,
            ),
          )
          .returning({ id: playersTable.id });

        if (debited.length === 0) {
          await tx
            .update(sessionsTable)
            .set({ status: "ended", endedAt: now })
            .where(eq(sessionsTable.id, session.id));
          return true;
        }

        if (hostGreenLzt > 0) {
          await tx
            .update(hostsTable)
            .set({
              withdrawableBalanceLzt: sql`${hostsTable.withdrawableBalanceLzt} + ${hostGreenLzt}`,
            })
            .where(eq(hostsTable.id, session.hostId));
        }
        if (hostBlueLzt > 0) {
          await tx
            .update(hostsTable)
            .set({
              internalBalanceLzt: sql`${hostsTable.internalBalanceLzt} + ${hostBlueLzt}`,
            })
            .where(eq(hostsTable.id, session.hostId));
        }

        // One billing_events row per bucket the host got credited in. The
        // player's debit is attributed to the row matching the bucket they
        // actually paid from (so debits never double-count).
        await tx.insert(billingEventsTable).values([
          {
            sessionId: session.id,
            hostId: session.hostId,
            playerId: session.claimedByPlayerId!,
            minutes: 1,
            bucket: "green",
            playerDebitLzt: bucket === "green" ? costLzt : 0,
            hostCreditLzt: hostGreenLzt,
          },
          {
            sessionId: session.id,
            hostId: session.hostId,
            playerId: session.claimedByPlayerId!,
            minutes: 1,
            bucket: "blue",
            playerDebitLzt: bucket === "blue" ? costLzt : 0,
            hostCreditLzt: hostBlueLzt,
          },
        ]);

        // After the debit, can the player still afford another minute on
        // any allowed bucket? If not, end the session in the same tx.
        const [post] = await tx
          .select({
            green: playersTable.withdrawableBalanceLzt,
            blue: playersTable.internalBalanceLzt,
          })
          .from(playersTable)
          .where(eq(playersTable.id, session.claimedByPlayerId!));
        const nextBucket = pickPlayerBucket(
          session.paymentSource,
          costLzt,
          post?.green ?? 0,
          post?.blue ?? 0,
        );
        if (nextBucket === null) {
          await tx
            .update(sessionsTable)
            .set({ status: "ended", endedAt: now, lastBilledAt: now })
            .where(eq(sessionsTable.id, session.id));
          return true;
        }

        await tx
          .update(sessionsTable)
          .set({ lastBilledAt: now })
          .where(eq(sessionsTable.id, session.id));
        return false;
      });

      if (ended) {
        logger.info(
          { sessionId: session.id },
          "Session ended — player out of LZT in allowed bucket(s)",
        );
      }
    } catch (err) {
      logger.error({ err, sessionId: session.id }, "Billing tick failed");
    }
  }
}

export function startBillingWorker(): void {
  if (interval) return;
  logger.info(
    { intervalMs: BILLING_INTERVAL_MS },
    "Starting billing worker",
  );
  interval = setInterval(() => {
    void billOnce().catch((err) => {
      logger.error({ err }, "Billing loop crashed");
    });
  }, BILLING_INTERVAL_MS);
  setTimeout(() => void billOnce().catch(() => {}), 5_000);
}

export function stopBillingWorker(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
