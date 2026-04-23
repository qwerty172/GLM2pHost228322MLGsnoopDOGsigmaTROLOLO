import { eq, and, sql, isNotNull, lte, or, isNull } from "drizzle-orm";
import {
  db,
  hostsTable,
  playersTable,
  sessionsTable,
  billingEventsTable,
} from "@workspace/db";
import { logger } from "./logger";

const BILLING_INTERVAL_MS = 60_000;
const COMMISSION_RATE = Number(process.env["WALLET_COMMISSION_RATE"] ?? "0.3");
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
    const rate = Number(session.ratePerMinute);
    if (!Number.isFinite(rate) || rate <= 0) continue;
    const playerDebit = rate;
    const commission = playerDebit * COMMISSION_RATE;
    const hostCredit = playerDebit - commission;
    const playerDebitStr = playerDebit.toFixed(6);
    const hostCreditStr = hostCredit.toFixed(6);
    const commissionStr = commission.toFixed(6);

    try {
      const ended = await db.transaction(async (tx) => {
        const debited = await tx
          .update(playersTable)
          .set({
            creditBalance: sql`${playersTable.creditBalance} - ${playerDebitStr}::numeric`,
          })
          .where(
            and(
              eq(playersTable.id, session.claimedByPlayerId!),
              sql`${playersTable.creditBalance} >= ${playerDebitStr}::numeric`,
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

        await tx
          .update(hostsTable)
          .set({
            creditBalance: sql`${hostsTable.creditBalance} + ${hostCreditStr}::numeric`,
          })
          .where(eq(hostsTable.id, session.hostId));

        await tx.insert(billingEventsTable).values({
          sessionId: session.id,
          hostId: session.hostId,
          playerId: session.claimedByPlayerId!,
          minutes: 1,
          playerDebit: playerDebitStr,
          hostCredit: hostCreditStr,
          commissionAmount: commissionStr,
        });

        await tx
          .update(sessionsTable)
          .set({ lastBilledAt: now })
          .where(eq(sessionsTable.id, session.id));
        return false;
      });

      if (ended) {
        logger.info(
          { sessionId: session.id },
          "Session ended — player out of credits",
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
    { intervalMs: BILLING_INTERVAL_MS, commission: COMMISSION_RATE },
    "Starting billing worker",
  );
  interval = setInterval(() => {
    void billOnce().catch((err) => {
      logger.error({ err }, "Billing loop crashed");
    });
  }, BILLING_INTERVAL_MS);
  // Run once shortly after startup so we don't wait a full minute.
  setTimeout(() => void billOnce().catch(() => {}), 5_000);
}

export function stopBillingWorker(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
