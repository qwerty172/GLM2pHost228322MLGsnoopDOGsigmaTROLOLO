import { and, eq, lt, isNotNull, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  db,
  quotasTable,
  quotaSessionsTable,
  sessionsTable,
  billingEventsTable,
} from "@workspace/db";
import { logger } from "./logger";
import { creditOwnerGreen } from "./quotaEngine";

const INTERVAL_MS = 60_000;
let interval: NodeJS.Timeout | null = null;

async function tickOnce(): Promise<void> {
  const now = new Date();
  // 1. Mark `expired` for any active/paused quota past its end_at and
  //    refund any remaining sponsor escrow.
  const expiring = await db
    .select()
    .from(quotasTable)
    .where(
      and(
        inArray(quotasTable.status, ["active", "paused"]),
        isNotNull(quotasTable.endAt),
        lt(quotasTable.endAt, now),
      ),
    );

  for (const q of expiring) {
    try {
      await db.transaction(async (tx) => {
        // Re-read with row lock — concurrent billing ticks may have
        // decremented escrow between the outer scan and this tx.
        const [fresh] = await tx
          .select()
          .from(quotasTable)
          .where(eq(quotasTable.id, q.id))
          .for("update");
        if (!fresh || fresh.status === "expired" || fresh.status === "closed") {
          return;
        }
        await tx
          .update(sessionsTable)
          .set({ quotaId: null })
          .where(eq(sessionsTable.quotaId, fresh.id));
        await tx
          .update(quotaSessionsTable)
          .set({ detachedAt: now })
          .where(eq(quotaSessionsTable.quotaId, fresh.id));
        const refund =
          fresh.kind === "sponsor" ? fresh.escrowRemainingLzt ?? 0 : 0;
        if (refund > 0) {
          await creditOwnerGreen(tx, fresh.ownerType, fresh.ownerId, refund);
          await tx.insert(billingEventsTable).values({
            sessionId: fresh.id,
            hostId:
              fresh.ownerType === "host"
                ? fresh.ownerId
                : "00000000-0000-0000-0000-000000000000",
            playerId:
              fresh.ownerType === "player"
                ? fresh.ownerId
                : "00000000-0000-0000-0000-000000000000",
            minutes: 0,
            bucket: "green",
            playerDebitLzt: 0,
            hostCreditLzt: refund,
            kind: "quota_escrow_refund",
            quotaId: fresh.id,
          });
        }
        await tx
          .update(quotasTable)
          .set({
            status: "expired",
            escrowRemainingLzt: 0,
            updatedAt: now,
          })
          .where(eq(quotasTable.id, fresh.id));
      });
      logger.info({ quotaId: q.id }, "Quota expired");
    } catch (err) {
      logger.error({ err, quotaId: q.id }, "Quota expiry tick failed");
    }
  }

  // 2. Catch any sponsor quota whose escrow ran out but status didn't get
  //    flipped (defensive — the billing worker also flips it).
  await db
    .update(quotasTable)
    .set({ status: "exhausted", updatedAt: now })
    .where(
      and(
        eq(quotasTable.status, "active"),
        eq(quotasTable.kind, "sponsor"),
        sql`coalesce(${quotasTable.escrowRemainingLzt}, 0) <= 0`,
      ),
    );
}

export function startQuotaExpiryWorker(): void {
  if (interval) return;
  logger.info({ intervalMs: INTERVAL_MS }, "Starting quota expiry worker");
  interval = setInterval(() => {
    void tickOnce().catch((err) => {
      logger.error({ err }, "Quota expiry loop crashed");
    });
  }, INTERVAL_MS);
  setTimeout(() => void tickOnce().catch(() => {}), 10_000);
}

export function stopQuotaExpiryWorker(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
