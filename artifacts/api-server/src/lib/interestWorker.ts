// Weekly balance-interest payout.
//
// Average-balance approximation:
//   avg ≈ (interestSampleLzt + currentInternalBalanceLzt) / 2
// where `interestSampleLzt` was set to the user's `internalBalanceLzt` at the
// end of the previous interest tick. This is the simplest defensible
// "average over the week" without instrumenting every site that mutates a
// balance. After computing avg we update the sample to the current balance
// for the next cycle.
//
// Payout = avg × RATE_HUNDREDTH_BPS / FRACTION_SCALE,
// integer-floored with the sub-LZT remainder carried in
// `pendingInterestFractionLzt`.

import { eq, sql } from "drizzle-orm";
import { db, hostsTable, playersTable } from "@workspace/db";
import { logger } from "./logger";
import { getPlatformSettings } from "./platformSettings";
import {
  drawFromSystemAccount,
  systemAccountBalance,
  writeLedger,
  SYSTEM_INTEREST_RESERVE,
} from "./economy";
import { randomUUID } from "node:crypto";

// Weekly cron: fires every Sunday at 00:00 UTC. We don't use setInterval from
// process start because that would drift relative to wall-clock and would
// silently shift the "weekly" boundary on every restart. Instead we compute
// the delay to the next Sunday 00:00 UTC, run, then schedule the next one.
//
// Targets default to Sunday (day-of-week 0) and hour 0 (UTC). Both are
// override-able via env so test environments can run a tick on demand.
const CRON_DOW = Math.min(
  6,
  Math.max(0, Number(process.env["WEEKLY_INTEREST_DOW_UTC"] ?? 0)),
);
const CRON_HOUR = Math.min(
  23,
  Math.max(0, Number(process.env["WEEKLY_INTEREST_HOUR_UTC"] ?? 0)),
);
// Rate is hundredth-of-bps × 100 — so 20 = 0.20%. Overridden by platform_settings.
const ENV_RATE_HBPS = Number(process.env["WEEKLY_INTEREST_RATE_HBPS"] ?? 20);
const FRACTION_SCALE = 10_000;
let timer: NodeJS.Timeout | null = null;
let stopped = false;

function msUntilNextRun(from: Date = new Date()): number {
  const next = new Date(
    Date.UTC(
      from.getUTCFullYear(),
      from.getUTCMonth(),
      from.getUTCDate(),
      CRON_HOUR,
      0,
      0,
      0,
    ),
  );
  // Advance to the next CRON_DOW. If we're already on the right day but past
  // the trigger hour, push to next week.
  const currentDow = next.getUTCDay();
  let daysAhead = (CRON_DOW - currentDow + 7) % 7;
  if (daysAhead === 0 && next.getTime() <= from.getTime()) daysAhead = 7;
  next.setUTCDate(next.getUTCDate() + daysAhead);
  return Math.max(1_000, next.getTime() - from.getTime());
}

async function payOnce(now: Date = new Date()): Promise<void> {
  const settings = await getPlatformSettings();
  if (!settings.interestEnabled) {
    logger.info("Weekly interest skipped — disabled in platform settings");
    return;
  }
  const rateHbps = settings.weeklyInterestRateHbps ?? ENV_RATE_HBPS;

  const reserveBefore = await db.transaction((tx) =>
    systemAccountBalance(tx, SYSTEM_INTEREST_RESERVE),
  );
  if (reserveBefore <= 0) {
    logger.info("Weekly interest skipped — empty reserve");
    return;
  }
  for (const tbl of [hostsTable, playersTable]) {
    const ownerType: "host" | "player" =
      tbl === hostsTable ? "host" : "player";
    const rows = await db
      .select({
        id: tbl.id,
        balance: tbl.internalBalanceLzt,
        sample: tbl.interestSampleLzt,
        fraction: tbl.pendingInterestFractionLzt,
      })
      .from(tbl);
    for (const u of rows) {
      // Time-weighted average over the week, capped below at 0 to avoid the
      // mid-cycle "user just registered" sample=0 case overstating payout
      // (it actually understates — still defensible).
      const avg = Math.max(0, Math.floor((u.sample + u.balance) / 2));
      if (avg <= 0 && u.fraction <= 0) {
        // Refresh the sample so we always reflect the latest balance even
        // when no payout happens this cycle.
        if (u.sample !== u.balance) {
          await db
            .update(tbl)
            .set({ interestSampleLzt: u.balance })
            .where(eq(tbl.id, u.id));
        }
        continue;
      }
      const scaledNew = avg * rateHbps;
      const totalScaled = scaledNew + u.fraction;
      const wholeLzt = Math.floor(totalScaled / FRACTION_SCALE);
      const remainder = totalScaled - wholeLzt * FRACTION_SCALE;

      try {
        await db.transaction(async (tx) => {
          if (wholeLzt > 0) {
            const ok = await drawFromSystemAccount(
              tx,
              SYSTEM_INTEREST_RESERVE,
              wholeLzt,
            );
            if (!ok) {
              // Not enough reserve — stash the whole accumulator in the
              // fraction so we can pay it next cycle.
              await tx
                .update(tbl)
                .set({
                  pendingInterestFractionLzt: totalScaled,
                  interestSampleLzt: u.balance,
                })
                .where(eq(tbl.id, u.id));
              return;
            }
            await tx
              .update(tbl)
              .set({
                internalBalanceLzt: sql`${tbl.internalBalanceLzt} + ${wholeLzt}`,
                pendingInterestFractionLzt: remainder,
                interestSampleLzt: u.balance + wholeLzt,
              })
              .where(eq(tbl.id, u.id));
            const groupId = randomUUID();
            await writeLedger(tx, [
              {
                groupId,
                kind: "interest_payout",
                ownerType,
                ownerId: u.id,
                bucket: "balance",
                deltaLzt: wholeLzt,
                refType: "system_account",
                refId: SYSTEM_INTEREST_RESERVE,
                note: `avg=${avg}`,
              },
              {
                groupId,
                kind: "interest_payout",
                ownerType: "system",
                ownerId: null,
                bucket: "reserve",
                deltaLzt: -wholeLzt,
                refType: "system_account",
                refId: SYSTEM_INTEREST_RESERVE,
              },
            ]);
          } else {
            await tx
              .update(tbl)
              .set({
                pendingInterestFractionLzt: remainder,
                interestSampleLzt: u.balance,
              })
              .where(eq(tbl.id, u.id));
          }
        });
      } catch (err) {
        logger.error(
          { err, ownerType, userId: u.id },
          "Interest payout failed",
        );
      }
    }
  }
  logger.info({ now }, "Weekly interest cycle complete");
}

function scheduleNext(): void {
  if (stopped) return;
  const delay = msUntilNextRun();
  logger.info(
    {
      nextRunAt: new Date(Date.now() + delay).toISOString(),
      dowUtc: CRON_DOW,
      hourUtc: CRON_HOUR,
    },
    "Weekly interest: next tick scheduled",
  );
  timer = setTimeout(() => {
    void payOnce()
      .catch((err) => logger.error({ err }, "Interest worker crashed"))
      .finally(() => scheduleNext());
  }, delay);
}

export function startInterestWorker(): void {
  if (timer) return;
  if (process.env["WEEKLY_INTEREST_ENABLED"] === "off") {
    logger.info("Interest worker disabled (WEEKLY_INTEREST_ENABLED=off)");
    return;
  }
  stopped = false;
  void getPlatformSettings().then((s) => {
    logger.info(
      {
        dowUtc: CRON_DOW,
        hourUtc: CRON_HOUR,
        rateHbps: s.weeklyInterestRateHbps,
        interestEnabled: s.interestEnabled,
      },
      "Starting weekly interest worker (UTC cron)",
    );
  });
  scheduleNext();
}

export function stopInterestWorker(): void {
  stopped = true;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

export { payOnce as runInterestPayoutOnce };
