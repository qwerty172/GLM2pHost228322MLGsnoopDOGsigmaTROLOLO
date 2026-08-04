import { eq, and, sql, isNotNull, lte, or, isNull } from "drizzle-orm";
import {
  db,
  hostsTable,
  playersTable,
  devKeysTable,
  sessionsTable,
  billingEventsTable,
  quotasTable,
  quotaSessionsTable,
  loansTable,
} from "@workspace/db";
import { logger } from "./logger";
import { usdtToLztRound, pickPlayerBucket, gamingCreditAllowsTick } from "./lzt";
import { sendSignalingMessage } from "./signaling";
import {
  computeQuotaEffect,
  decrementEscrow,
  recordQuotaMovement,
  bumpQuotaSessionTotals,
  isQuotaActiveNow,
} from "./quotaEngine";
import {
  adjustUserBucket,
  creditPayoutToUser,
  writeLedger,
} from "./economy";
import { countSessionMinutesUsed, refundBlockRemainder } from "./sessionBilling";
import { randomUUID } from "node:crypto";

export { refundBlockRemainder, countSessionMinutesUsed };

const BILLING_INTERVAL_MS = 60_000;
let interval: NodeJS.Timeout | null = null;

// Returns the total LZT this player already owes this host on `host_service`
// loans (active or otherwise unpaid).
async function outstandingHostServiceLzt(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  hostId: string,
  playerId: string,
): Promise<number> {
  const rows = await tx
    .select({ s: sql<number>`COALESCE(SUM(${loansTable.outstandingLzt}), 0)::int` })
    .from(loansTable)
    .where(
      and(
        eq(loansTable.loanType, "host_service"),
        eq(loansTable.lenderType, "host"),
        eq(loansTable.lenderId, hostId),
        eq(loansTable.borrowerType, "player"),
        eq(loansTable.borrowerId, playerId),
        eq(loansTable.status, "active"),
      ),
    );
  return Number(rows[0]?.s ?? 0);
}

/** Atomically claim a billing slot so multi-instance workers cannot double-bill. */
async function claimBillingSlot(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  sessionId: string,
  cutoff: Date,
  now: Date,
): Promise<boolean> {
  const claimed = await tx
    .update(sessionsTable)
    .set({ lastBilledAt: now })
    .where(
      and(
        eq(sessionsTable.id, sessionId),
        eq(sessionsTable.status, "active"),
        or(
          isNull(sessionsTable.lastBilledAt),
          lte(sessionsTable.lastBilledAt, cutoff),
        ),
      ),
    )
    .returning({ id: sessionsTable.id });
  return claimed.length > 0;
}

// Overlap guard: a billing cycle that runs long (DB contention) must not stack
// with the next tick — concurrent runs risk double-billing / lock exhaustion.
let isBilling = false;

async function billOnce(): Promise<void> {
  if (isBilling) return;
  isBilling = true;
  try {
    await billOnceInner();
  } finally {
    isBilling = false;
  }
}

async function billOnceInner(): Promise<void> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - BILLING_INTERVAL_MS);
  const eligible = await db
    .select()
    .from(sessionsTable)
    .where(
      and(
        eq(sessionsTable.status, "active"),
        // Host self-test sessions are never billed.
        eq(sessionsTable.isTest, false),
        or(
          isNotNull(sessionsTable.claimedByPlayerId),
          isNotNull(sessionsTable.devKeyId),
        ),
        or(
          isNull(sessionsTable.lastBilledAt),
          lte(sessionsTable.lastBilledAt, cutoff),
        ),
      ),
    );

  for (const session of eligible) {
    if (!session.claimedByPlayerId && !session.devKeyId) continue;
    const rateUsd = Number(session.ratePerMinute);
    if (!Number.isFinite(rateUsd) || rateUsd <= 0) continue;
    const costLzt = usdtToLztRound(rateUsd);
    if (costLzt <= 0) continue;

    // ---------------------------------------------------------------
    // Dev-key-funded (embed widget) sessions: no player, no loans/quota
    // fallback — just debit the key's own two buckets (blue then green)
    // and end the session with a clear "key_balance_exhausted" reason if
    // it can't cover the tick. See task-125.
    // ---------------------------------------------------------------
    if (session.devKeyId) {
      try {
        const ended = await db.transaction(async (tx) => {
          // Claim first so another API instance cannot bill the same tick.
          if (!(await claimBillingSlot(tx, session.id, cutoff, now))) {
            return false;
          }

          const [key] = await tx
            .select({
              blue: devKeysTable.internalBalanceLzt,
              green: devKeysTable.withdrawableBalanceLzt,
            })
            .from(devKeysTable)
            .where(eq(devKeysTable.id, session.devKeyId!));
          const blue = key?.blue ?? 0;
          const green = key?.green ?? 0;

          let bucketCol: "internalBalanceLzt" | "withdrawableBalanceLzt" | null =
            null;
          if (blue >= costLzt) bucketCol = "internalBalanceLzt";
          else if (green >= costLzt) bucketCol = "withdrawableBalanceLzt";

          if (!bucketCol) {
            await tx
              .update(sessionsTable)
              .set({
                status: "ended",
                endedAt: now,
                endReason: "key_balance_exhausted",
              })
              .where(eq(sessionsTable.id, session.id));
            return true;
          }

          const debited = await tx
            .update(devKeysTable)
            .set({
              [bucketCol]: sql`${devKeysTable[bucketCol]} - ${costLzt}`,
            } as never)
            .where(
              and(
                eq(devKeysTable.id, session.devKeyId!),
                sql`${devKeysTable[bucketCol]} >= ${costLzt}`,
              ),
            )
            .returning({ id: devKeysTable.id });

          if (debited.length === 0) {
            await tx
              .update(sessionsTable)
              .set({
                status: "ended",
                endedAt: now,
                endReason: "key_balance_exhausted",
              })
              .where(eq(sessionsTable.id, session.id));
            return true;
          }

          const payoutSplit = await creditPayoutToUser(tx, {
            ownerType: "host",
            ownerId: session.hostId,
            amountLzt: costLzt,
            kind: "session_tick",
            refType: "session",
            refId: session.id,
          });

          await tx.insert(billingEventsTable).values({
            sessionId: session.id,
            hostId: session.hostId,
            playerId: null,
            minutes: 1,
            bucket: bucketCol === "withdrawableBalanceLzt" ? "green" : "blue",
            playerDebitLzt: costLzt,
            hostCreditLzt: payoutSplit.cash + payoutSplit.balance,
            kind: "session_tick",
          });

          await writeLedger(tx, [
            {
              groupId: randomUUID(),
              kind: "session_tick",
              ownerType: "dev_key",
              ownerId: session.devKeyId!,
              bucket: bucketCol === "withdrawableBalanceLzt" ? "cash" : "balance",
              deltaLzt: -costLzt,
              refType: "session",
              refId: session.id,
            },
          ]);

          return false;
        });

        if (ended) {
          logger.info(
            { sessionId: session.id },
            "Embed session ended — dev key balance exhausted",
          );
        }
      } catch (err) {
        logger.error({ err, sessionId: session.id }, "Dev-key billing tick failed");
      }
      continue;
    }

    if (!session.claimedByPlayerId) continue;

    try {
      const ended = await db.transaction(async (tx) => {
        // Claim first so another API instance cannot bill the same tick.
        if (!(await claimBillingSlot(tx, session.id, cutoff, now))) {
          return false;
        }

        const quota = session.quotaId
          ? (
              await tx
                .select()
                .from(quotasTable)
                .where(eq(quotasTable.id, session.quotaId))
            )[0] ?? null
          : null;

        // +1 for the tick we are about to record (includes credit ticks).
        const minutesInto = (await countSessionMinutesUsed(tx, session.id)) + 1;

        const quotaActive = quota && isQuotaActiveNow(quota, now);
        const effect = quotaActive
          ? computeQuotaEffect(quota!, costLzt, minutesInto)
          : { royaltyLzt: 0, sponsorHostLzt: 0, sponsorPlayerLzt: 0 };

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

        // ---------- Prepaid block sessions ----------
        // Player was debited blockReservedLzt at claim; pay the host each tick
        // from that reserve without further player balance debits.
        if (session.blockMinutes && session.blockReservedLzt) {
          if (minutesInto >= session.blockMinutes) {
            await tx
              .update(sessionsTable)
              .set({
                status: "ended",
                endedAt: now,
                endReason: "block_expired",
                lastBilledAt: now,
              })
              .where(eq(sessionsTable.id, session.id));
            return "block_expired";
          }

          const payoutSplit = await creditPayoutToUser(tx, {
            ownerType: "host",
            ownerId: session.hostId,
            amountLzt: hostNetLzt,
            kind: "session_tick",
            refType: "session",
            refId: session.id,
          });

          await tx.insert(billingEventsTable).values([
            {
              sessionId: session.id,
              hostId: session.hostId,
              playerId: session.claimedByPlayerId!,
              minutes: 1,
              bucket: "green",
              playerDebitLzt: 0,
              hostCreditLzt: payoutSplit.cash,
              kind: "session_tick",
            },
            {
              sessionId: session.id,
              hostId: session.hostId,
              playerId: session.claimedByPlayerId!,
              minutes: 1,
              bucket: "blue",
              playerDebitLzt: 0,
              hostCreditLzt: payoutSplit.balance,
              kind: "session_tick",
            },
          ]);

          const minsLeft = session.blockMinutes - minutesInto;
          await tx
            .update(sessionsTable)
            .set({ lastBilledAt: now })
            .where(eq(sessionsTable.id, session.id));
          return { blockWarning: minsLeft === 2 };
        }

        const [player] = await tx
          .select({
            green: playersTable.withdrawableBalanceLzt,
            blue: playersTable.internalBalanceLzt,
            creditLimitLzt: playersTable.creditLimitLzt,
            creditDebtLzt: playersTable.creditDebtLzt,
            maxDep: playersTable.maxDepositUsdtCents,
            maxWd: playersTable.maxWithdrawalUsdtCents,
          })
          .from(playersTable)
          .where(eq(playersTable.id, session.claimedByPlayerId!));

        const bucket = pickPlayerBucket(
          session.paymentSource,
          playerDebitLzt,
          player?.green ?? 0,
          player?.blue ?? 0,
        );

        // ---------- Host-service credit fallback ----------
        // If the player can't pay this tick AND the host has the
        // "play-on-credit" policy enabled AND we're under the per-player cap,
        // continue the session: open/extend a `host_service` loan instead of
        // ending the session. The host gets nothing this minute; it will trickle
        // back via the 40/40/20 split as the player earns later.
        if (bucket === null) {
          const [host] = await tx
            .select({
              creditMin: hostsTable.creditMinutesPerNewPlayer,
              creditMax: hostsTable.creditMaxLztPerPlayer,
            })
            .from(hostsTable)
            .where(eq(hostsTable.id, session.hostId));
          const minutesAllowed = host?.creditMin ?? 0;
          const maxLzt = host?.creditMax ?? 0;
          // Host service credit is intentionally scoped to *newcomers* only —
          // players with zero pledger history (no deposit, no withdrawal).
          // Established players have other credit avenues (P2P) and don't
          // need the platform-subsidised play-in-debt path.
          const isNewcomer =
            (player?.maxDep ?? 0) === 0 && (player?.maxWd ?? 0) === 0;
          const creditLineOk = gamingCreditAllowsTick(
            player?.creditLimitLzt ?? 0,
            player?.creditDebtLzt ?? 0,
            playerDebitLzt,
          );
          if (minutesAllowed > 0 && maxLzt > 0 && isNewcomer && creditLineOk) {
            const outstanding = await outstandingHostServiceLzt(
              tx,
              session.hostId,
              session.claimedByPlayerId!,
            );
            // Cap by both per-minute and per-LZT limits.
            const minutesUsed = Math.ceil(outstanding / Math.max(1, costLzt));
            if (
              minutesUsed < minutesAllowed &&
              outstanding + playerDebitLzt <= maxLzt
            ) {
              // Open a new host_service loan if none open yet; else extend.
              const existing = await tx
                .select()
                .from(loansTable)
                .where(
                  and(
                    eq(loansTable.loanType, "host_service"),
                    eq(loansTable.lenderType, "host"),
                    eq(loansTable.lenderId, session.hostId),
                    eq(loansTable.borrowerType, "player"),
                    eq(loansTable.borrowerId, session.claimedByPlayerId!),
                    eq(loansTable.status, "active"),
                  ),
                );
              let loanId: string;
              if (existing.length > 0 && existing[0]) {
                await tx
                  .update(loansTable)
                  .set({
                    principalLzt: existing[0].principalLzt + playerDebitLzt,
                    outstandingLzt: existing[0].outstandingLzt + playerDebitLzt,
                  })
                  .where(eq(loansTable.id, existing[0].id));
                loanId = existing[0].id;
              } else {
                const [created] = await tx
                  .insert(loansTable)
                  .values({
                    loanType: "host_service",
                    lenderType: "host",
                    lenderId: session.hostId,
                    borrowerType: "player",
                    borrowerId: session.claimedByPlayerId!,
                    principalLzt: playerDebitLzt,
                    outstandingLzt: playerDebitLzt,
                    repaidLzt: 0,
                    platformFeeLzt: 0,
                    // balance_streaming: every repayment slice (from deposit or
                    // earnings) is immediately credited to the host's balance
                    // rather than sitting in escrow until full close.
                    lenderPayoutMode: "balance_streaming",
                    status: "active",
                    dueAt: new Date(
                      Date.now() + 60 * 24 * 3600 * 1000,
                    ),
                  })
                  .returning();
                loanId = created!.id;
              }
              await adjustUserBucket(
                tx,
                "player",
                session.claimedByPlayerId!,
                "debt",
                playerDebitLzt,
              );
              await tx
                .update(hostsTable)
                .set({
                  creditReceivableLzt: sql`${hostsTable.creditReceivableLzt} + ${playerDebitLzt}`,
                })
                .where(eq(hostsTable.id, session.hostId));
              const groupId = randomUUID();
              await writeLedger(tx, [
                {
                  groupId,
                  kind: "host_service_credit",
                  ownerType: "player",
                  ownerId: session.claimedByPlayerId!,
                  bucket: "debt",
                  deltaLzt: playerDebitLzt,
                  refType: "loan",
                  refId: loanId,
                },
              ]);
              await tx.insert(billingEventsTable).values({
                sessionId: session.id,
                hostId: session.hostId,
                playerId: session.claimedByPlayerId!,
                minutes: 1,
                bucket: "green",
                playerDebitLzt: 0,
                hostCreditLzt: 0,
                kind: "session_tick_credit",
              });
              // Block sessions on credit still consume reserved minutes.
              if (session.blockMinutes && minutesInto >= session.blockMinutes) {
                await tx
                  .update(sessionsTable)
                  .set({
                    status: "ended",
                    endedAt: now,
                    endReason: "block_expired",
                  })
                  .where(eq(sessionsTable.id, session.id));
                return "block_expired";
              }
              return false;
            }
          }
          // No credit available — end the session.
          await tx
            .update(sessionsTable)
            .set({ status: "ended", endedAt: now, endReason: "balance_exhausted" })
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
            .set({ status: "ended", endedAt: now, endReason: "balance_exhausted" })
            .where(eq(sessionsTable.id, session.id));
          return true;
        }

        // ---------- Host payout via economy split (handles debt) ----------
        const payoutSplit = await creditPayoutToUser(tx, {
          ownerType: "host",
          ownerId: session.hostId,
          amountLzt: hostNetLzt,
          kind: "session_tick",
          refType: "session",
          refId: session.id,
        });

        await tx.insert(billingEventsTable).values([
          {
            sessionId: session.id,
            hostId: session.hostId,
            playerId: session.claimedByPlayerId!,
            minutes: 1,
            bucket: "green",
            playerDebitLzt: bucket === "green" ? playerDebitLzt : 0,
            hostCreditLzt: payoutSplit.cash,
            kind: "session_tick",
          },
          {
            sessionId: session.id,
            hostId: session.hostId,
            playerId: session.claimedByPlayerId!,
            minutes: 1,
            bucket: "blue",
            playerDebitLzt: bucket === "blue" ? playerDebitLzt : 0,
            hostCreditLzt: payoutSplit.balance,
            kind: "session_tick",
          },
        ]);

        // Also record the player-side debit in the ledger.
        await writeLedger(tx, [
          {
            groupId: randomUUID(),
            kind: "session_tick",
            ownerType: "player",
            ownerId: session.claimedByPlayerId!,
            bucket: bucket === "green" ? "cash" : "balance",
            deltaLzt: -playerDebitLzt,
            refType: "session",
            refId: session.id,
          },
        ]);

        // ---------- Quota movements (unchanged from prior logic) ----------
        if (quotaActive && quota) {
          if (effect.royaltyLzt > 0) {
            // Route through creditPayoutToUser so the 40/40/20 split applies
            // automatically when the royalty recipient currently has debt.
            await creditPayoutToUser(tx, {
              ownerType: quota.ownerType as "host" | "player",
              ownerId: quota.ownerId,
              amountLzt: effect.royaltyLzt,
              kind: "quota_royalty",
              refType: "quota",
              refId: quota.id,
            });
            await recordQuotaMovement(tx, {
              sessionId: session.id,
              hostId: session.hostId,
              playerId: session.claimedByPlayerId!,
              quotaId: quota.id,
              kind: "quota_royalty",
              amountLzt: effect.royaltyLzt,
            });
          }
          const sponsorTotal = effect.sponsorHostLzt + effect.sponsorPlayerLzt;
          let sponsorPaidHost = 0;
          let sponsorPaidPlayer = 0;
          if (sponsorTotal > 0) {
            const ok = await decrementEscrow(tx, quota.id, sponsorTotal);
            if (ok) {
              sponsorPaidHost = effect.sponsorHostLzt;
              sponsorPaidPlayer = effect.sponsorPlayerLzt;
              if (effect.sponsorHostLzt > 0) {
                // Use creditPayoutToUser to apply the 40/40/20 debt split if
                // the host currently owes money — otherwise it behaves like a
                // 50/50 deposit (cash + balance), matching the v1 spec.
                await creditPayoutToUser(tx, {
                  ownerType: "host",
                  ownerId: session.hostId,
                  amountLzt: effect.sponsorHostLzt,
                  kind: "quota_sponsor_host",
                  refType: "quota",
                  refId: quota.id,
                });
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
                await creditPayoutToUser(tx, {
                  ownerType: "player",
                  ownerId: session.claimedByPlayerId!,
                  amountLzt: effect.sponsorPlayerLzt,
                  kind: "quota_sponsor_player",
                  refType: "quota",
                  refId: quota.id,
                });
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
          await bumpQuotaSessionTotals(tx, {
            quotaId: quota.id,
            sessionId: session.id,
            royaltyLzt: effect.royaltyLzt,
            sponsorHostLzt: sponsorPaidHost,
            sponsorPlayerLzt: sponsorPaidPlayer,
          });
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

        await tx
          .update(sessionsTable)
          .set({ lastBilledAt: now })
          .where(eq(sessionsTable.id, session.id));

        // ---------- Block expiry check ----------
        // For block sessions: check if minutesInto >= blockMinutes.
        // If yes, end the session (block exhausted, reserve already fully used).
        // If minutesInto === blockMinutes - 2, send a "block-warning" to the player.
        if (session.blockMinutes) {
          if (minutesInto >= session.blockMinutes) {
            // Block fully consumed. End the session; no refund needed (all minutes used).
            await tx
              .update(sessionsTable)
              .set({ status: "ended", endedAt: now, endReason: "block_expired" })
              .where(eq(sessionsTable.id, session.id));
            return "block_expired";
          }
          // Send 2-minute warning to the player via signaling room.
          const minsLeft = session.blockMinutes - minutesInto;
          return { blockWarning: minsLeft === 2 };
        }

        return false;
      });

      if (ended === "block_expired") {
        logger.info({ sessionId: session.id }, "Block session expired — block time exhausted");
        // Notify the player via signaling
        sendSignalingMessage(session.id, { type: "block-expired" });
      } else if (ended && typeof ended === "object" && "blockWarning" in ended) {
        if ((ended as { blockWarning?: boolean }).blockWarning) {
          sendSignalingMessage(session.id, { type: "block-warning", minsLeft: 2 });
        }
      } else if (ended === true) {
        logger.info(
          { sessionId: session.id },
          "Session ended — player out of LZT and no host-service credit available",
        );
      }
    } catch (err) {
      logger.error({ err, sessionId: session.id }, "Billing tick failed");
    }
  }

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
  setTimeout(
    () =>
      void billOnce().catch((err) => {
        logger.error({ err }, "Initial billing tick failed");
      }),
    5_000,
  );
}

export function stopBillingWorker(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
