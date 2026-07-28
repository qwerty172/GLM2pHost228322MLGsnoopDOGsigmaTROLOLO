import { and, eq, lte, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db, dripSchedulesTable } from "@workspace/db";
import { logger } from "./logger";
import {
  adjustUserBucket,
  drawFromSystemAccount,
  writeLedger,
  SYSTEM_DRIP_RESERVE,
  type OwnerType,
  type UserBucket,
} from "./economy";

const TICK_MS = 60_000;
let interval: NodeJS.Timeout | null = null;

function addInterval(from: Date, interval: string): Date {
  const d = new Date(from);
  if (interval === "weekly") {
    d.setUTCDate(d.getUTCDate() + 7);
  } else {
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return d;
}

async function processDripsOnce(now = new Date()): Promise<void> {
  const due = await db
    .select()
    .from(dripSchedulesTable)
    .where(
      and(
        eq(dripSchedulesTable.status, "active"),
        lte(dripSchedulesTable.nextTickAt, now),
      ),
    )
    .limit(50);

  for (const schedule of due) {
    try {
      await db.transaction(async (tx) => {
        const [locked] = await tx
          .select()
          .from(dripSchedulesTable)
          .where(
            and(
              eq(dripSchedulesTable.id, schedule.id),
              eq(dripSchedulesTable.status, "active"),
              lte(dripSchedulesTable.nextTickAt, now),
            ),
          );
        if (!locked) return;

        const amount = locked.amountLztPerTick;
        const bucket = locked.bucket as UserBucket;
        const ownerType = locked.ownerType as OwnerType;

        const drawn = await drawFromSystemAccount(
          tx,
          SYSTEM_DRIP_RESERVE,
          amount,
        );
        if (!drawn) {
          logger.warn(
            { dripId: locked.id },
            "Drip tick skipped — empty drip_reserve",
          );
          return;
        }

        const credited = await adjustUserBucket(
          tx,
          ownerType,
          locked.ownerId,
          bucket,
          amount,
        );
        if (!credited) {
          throw new Error("drip_credit_failed");
        }

        const groupId = randomUUID();
        await writeLedger(tx, [
          {
            groupId,
            kind: "drip_payout",
            ownerType,
            ownerId: locked.ownerId,
            bucket,
            deltaLzt: amount,
            refType: "drip_schedule",
            refId: locked.id,
            note: locked.note || undefined,
          },
          {
            groupId,
            kind: "drip_payout",
            ownerType: "system",
            ownerId: null,
            bucket: "reserve",
            deltaLzt: -amount,
            refType: "system_account",
            refId: SYSTEM_DRIP_RESERVE,
          },
        ]);

        const ticksDone = locked.ticksDone + 1;
        const completed = ticksDone >= locked.ticksTotal;
        await tx
          .update(dripSchedulesTable)
          .set({
            ticksDone,
            status: completed ? "completed" : "active",
            nextTickAt: completed
              ? locked.nextTickAt
              : addInterval(locked.nextTickAt, locked.interval),
            updatedAt: now,
          })
          .where(eq(dripSchedulesTable.id, locked.id));
      });
    } catch (err) {
      logger.error({ err, dripId: schedule.id }, "Drip tick failed");
    }
  }
}

export function startDripWorker(): void {
  if (interval) return;
  if (process.env.DRIP_WORKER_ENABLED === "off") {
    logger.info("Drip worker disabled (DRIP_WORKER_ENABLED=off)");
    return;
  }
  interval = setInterval(() => {
    void processDripsOnce().catch((err) =>
      logger.error({ err }, "Drip worker tick failed"),
    );
  }, TICK_MS);
  logger.info("Drip worker started");
}

export function stopDripWorker(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}

export { processDripsOnce as runDripOnce };
