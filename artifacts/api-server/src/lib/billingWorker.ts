import { eq, and, sql, isNotNull, lte, or, isNull } from "drizzle-orm";
import {
  db,
  hostsTable,
  playersTable,
  sessionsTable,
  billingEventsTable,
  quotasTable,
  quotaSessionsTable,
} from "@workspace/db";
import { logger } from "./logger";
import { usdtToLztRound, pickPlayerBucket } from "./lzt";
import {
  computeQuotaEffect,
  creditOwnerGreen,
  decrementEscrow,
  recordQuotaMovement,
  bumpQuotaSessionTotals,
  isQuotaActiveNow,
} from "./quotaEngine";

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

    try {
      const ended = await db.transaction(async (tx) => {
        // Pre-load quota (if any), inside the same tx so the row is consistent
        // with the rest of the tick.
        const quota = session.quotaId
          ? (
              await tx
                .select()
                .from(quotasTable)
                .where(eq(quotasTable.id, session.quotaId))
            )[0] ?? null
          : null;

        // Minutes-into-session: simple count = how many session_tick rows
        // we've already recorded.
        const ticksRow = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(billingEventsTable)
          .where(
            and(
              eq(billingEventsTable.sessionId, session.id),
              eq(billingEventsTable.kind, "session_tick"),
              eq(billingEventsTable.bucket, "green"),
            ),
          );
        // ticks already recorded count is the number of past minutes; current
        // tick is therefore the next one.
        const minutesInto = Number(ticksRow[0]?.n ?? 0) + 1;

        const quotaActive = quota && isQuotaActiveNow(quota, now);
        const effect = quotaActive
          ? computeQuotaEffect(quota!, costLzt, minutesInto)
          : { royaltyLzt: 0, sponsorHostLzt: 0, sponsorPlayerLzt: 0 };

        // Player debit math. royaltySource=player → debit goes up by royalty;
        // host_share → host's payout shrinks instead.
        const royaltyFromPlayer =
          quotaActive && quota!.royaltySource === "player"
            ? effect.royaltyLzt
            : 0;
        const royaltyFromHost =
          quotaActive && quota!.royaltySource === "host_share"
            ? effect.royaltyLzt
            : 0;

        const playerDebitLzt = costLzt + royaltyFromPlayer;
        const hostNetLzt = Math.max(0, costLzt - royaltyFromHost);

        const [player] = await tx
          .select({
            green: playersTable.withdrawableBalanceLzt,
            blue: playersTable.internalBalanceLzt,
          })
          .from(playersTable)
          .where(eq(playersTable.id, session.claimedByPlayerId!));

        const bucket = pickPlayerBucket(
          session.paymentSource,
          playerDebitLzt,
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
                  withdrawableBalanceLzt: sql`${playersTable.withdrawableBalanceLzt} - ${playerDebitLzt}`,
                }
              : {
                  internalBalanceLzt: sql`${playersTable.internalBalanceLzt} - ${playerDebitLzt}`,
                },
          )
          .where(
            and(
              eq(playersTable.id, session.claimedByPlayerId!),
              sql`${playerCol} >= ${playerDebitLzt}`,
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

        const hostGreenLzt = Math.ceil(hostNetLzt / 2);
        const hostBlueLzt = Math.floor(hostNetLzt / 2);
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

        await tx.insert(billingEventsTable).values([
          {
            sessionId: session.id,
            hostId: session.hostId,
            playerId: session.claimedByPlayerId!,
            minutes: 1,
            bucket: "green",
            playerDebitLzt: bucket === "green" ? playerDebitLzt : 0,
            hostCreditLzt: hostGreenLzt,
            kind: "session_tick",
          },
          {
            sessionId: session.id,
            hostId: session.hostId,
            playerId: session.claimedByPlayerId!,
            minutes: 1,
            bucket: "blue",
            playerDebitLzt: bucket === "blue" ? playerDebitLzt : 0,
            hostCreditLzt: hostBlueLzt,
            kind: "session_tick",
          },
        ]);

        // ---------- Quota movements ----------
        if (quotaActive && quota) {
          // Royalty: credit owner's green from whichever side paid (the money
          // is already in the player→host pipeline; we just shift it).
          if (effect.royaltyLzt > 0) {
            await creditOwnerGreen(
              tx,
              quota.ownerType,
              quota.ownerId,
              effect.royaltyLzt,
            );
            await recordQuotaMovement(tx, {
              sessionId: session.id,
              hostId: session.hostId,
              playerId: session.claimedByPlayerId!,
              quotaId: quota.id,
              kind: "quota_royalty",
              amountLzt: effect.royaltyLzt,
            });
          }
          // Sponsor: pull from escrow, credit recipient green.
          const sponsorTotal = effect.sponsorHostLzt + effect.sponsorPlayerLzt;
          let sponsorPaidHost = 0;
          let sponsorPaidPlayer = 0;
          if (sponsorTotal > 0) {
            const ok = await decrementEscrow(tx, quota.id, sponsorTotal);
            if (ok) {
              sponsorPaidHost = effect.sponsorHostLzt;
              sponsorPaidPlayer = effect.sponsorPlayerLzt;
              if (effect.sponsorHostLzt > 0) {
                await tx
                  .update(hostsTable)
                  .set({
                    withdrawableBalanceLzt: sql`${hostsTable.withdrawableBalanceLzt} + ${effect.sponsorHostLzt}`,
                  })
                  .where(eq(hostsTable.id, session.hostId));
                await tx.insert(billingEventsTable).values({
                  sessionId: session.id,
                  hostId: session.hostId,
                  playerId: session.claimedByPlayerId!,
                  minutes: 0,
                  bucket: "green",
                  playerDebitLzt: 0,
                  hostCreditLzt: effect.sponsorHostLzt,
                  kind: "quota_sponsor_host",
                  quotaId: quota.id,
                });
              }
              if (effect.sponsorPlayerLzt > 0) {
                await tx
                  .update(playersTable)
                  .set({
                    withdrawableBalanceLzt: sql`${playersTable.withdrawableBalanceLzt} + ${effect.sponsorPlayerLzt}`,
                  })
                  .where(eq(playersTable.id, session.claimedByPlayerId!));
                await tx.insert(billingEventsTable).values({
                  sessionId: session.id,
                  hostId: session.hostId,
                  playerId: session.claimedByPlayerId!,
                  minutes: 0,
                  bucket: "green",
                  playerDebitLzt: 0,
                  hostCreditLzt: effect.sponsorPlayerLzt,
                  kind: "quota_sponsor_player",
                  quotaId: quota.id,
                });
              }
            }
          }

          // Only count what actually moved: royalty always pays (it's part of
          // the player→host pipeline), sponsor amounts only when escrow
          // decrement succeeded.
          await bumpQuotaSessionTotals(tx, {
            quotaId: quota.id,
            sessionId: session.id,
            royaltyLzt: effect.royaltyLzt,
            sponsorHostLzt: sponsorPaidHost,
            sponsorPlayerLzt: sponsorPaidPlayer,
          });

          // If the sponsor escrow just ran out, flip the status so future
          // ticks (and the picker) skip it. Sessions keep running.
          const [post] = await tx
            .select({
              remaining: quotasTable.escrowRemainingLzt,
              kind: quotasTable.kind,
              status: quotasTable.status,
            })
            .from(quotasTable)
            .where(eq(quotasTable.id, quota.id));
          if (
            post &&
            post.kind === "sponsor" &&
            post.status === "active" &&
            (post.remaining ?? 0) <= 0
          ) {
            await tx
              .update(quotasTable)
              .set({ status: "exhausted", updatedAt: now })
              .where(eq(quotasTable.id, quota.id));
          }
        }

        // After the debit, can the player still afford another minute on
        // any allowed bucket? If not, end the session in the same tx.
        const [postPlayer] = await tx
          .select({
            green: playersTable.withdrawableBalanceLzt,
            blue: playersTable.internalBalanceLzt,
          })
          .from(playersTable)
          .where(eq(playersTable.id, session.claimedByPlayerId!));
        const nextBucket = pickPlayerBucket(
          session.paymentSource,
          costLzt,
          postPlayer?.green ?? 0,
          postPlayer?.blue ?? 0,
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

  // Best-effort cleanup: detach quota_sessions rows whose session is no
  // longer attached or has ended.
  await db
    .update(quotaSessionsTable)
    .set({ detachedAt: now })
    .where(
      and(
        isNull(quotaSessionsTable.detachedAt),
        sql`exists (select 1 from ${sessionsTable} s where s.id = ${quotaSessionsTable.sessionId} and (s.status = 'ended' or s.quota_id is null or s.quota_id <> ${quotaSessionsTable.quotaId}))`,
      ),
    );
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
