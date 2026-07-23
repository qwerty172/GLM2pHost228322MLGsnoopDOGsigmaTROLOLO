// Outbox worker — polls pending rows and dispatches idempotent side-effect handlers.

import { eq, and, lt, sql } from "drizzle-orm";
import { db, outboxTable } from "@workspace/db";
import { logger } from "./logger";

const POLL_MS = 5_000;
const MAX_ATTEMPTS = 8;

type OutboxHandler = (payload: unknown) => Promise<void>;

const handlers = new Map<string, OutboxHandler>();

export function registerOutboxHandler(
  eventType: string,
  handler: OutboxHandler,
): void {
  handlers.set(eventType, handler);
}

async function processRow(row: typeof outboxTable.$inferSelect): Promise<void> {
  const handler = handlers.get(row.eventType);
  if (!handler) {
    logger.warn({ eventType: row.eventType, id: row.id }, "No outbox handler");
    await db
      .update(outboxTable)
      .set({ status: "failed", attempts: row.attempts + 1 })
      .where(eq(outboxTable.id, row.id));
    return;
  }

  await db
    .update(outboxTable)
    .set({ status: "processing", attempts: row.attempts + 1 })
    .where(eq(outboxTable.id, row.id));

  try {
    await handler(row.payload);
    await db
      .update(outboxTable)
      .set({ status: "done", processedAt: new Date() })
      .where(eq(outboxTable.id, row.id));
  } catch (err) {
    const nextAttempts = row.attempts + 1;
    const status = nextAttempts >= MAX_ATTEMPTS ? "failed" : "pending";
    logger.error({ err, id: row.id, eventType: row.eventType }, "Outbox handler failed");
    await db
      .update(outboxTable)
      .set({ status, attempts: nextAttempts })
      .where(eq(outboxTable.id, row.id));
  }
}

async function pollOutbox(): Promise<void> {
  const rows = await db
    .select()
    .from(outboxTable)
    .where(
      and(
        eq(outboxTable.status, "pending"),
        lt(outboxTable.attempts, MAX_ATTEMPTS),
      ),
    )
    .orderBy(outboxTable.createdAt)
    .limit(20);

  for (const row of rows) {
    await processRow(row);
  }
}

export function startOutboxWorker(): void {
  registerOutboxHandler("deposit_confirmed", async (payload) => {
    logger.info({ payload }, "Outbox: deposit_confirmed");
  });
  registerOutboxHandler("withdrawal_requested", async (payload) => {
    logger.info({ payload }, "Outbox: withdrawal_requested");
  });
  registerOutboxHandler("session_billed", async (payload) => {
    logger.info({ payload }, "Outbox: session_billed");
  });

  setInterval(() => {
    void pollOutbox();
  }, POLL_MS).unref();
}

export async function insertOutboxEvent(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  args: {
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload: Record<string, unknown>;
    idempotencyKey: string;
  },
): Promise<void> {
  await tx.insert(outboxTable).values({
    aggregateType: args.aggregateType,
    aggregateId: args.aggregateId,
    eventType: args.eventType,
    payload: args.payload,
    idempotencyKey: args.idempotencyKey,
    status: "pending",
  }).onConflictDoNothing();
}

/** Cleanup outbox rows older than 7 days. */
export async function cleanupOutbox(): Promise<void> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  await db
    .delete(outboxTable)
    .where(
      and(
        eq(outboxTable.status, "done"),
        lt(outboxTable.processedAt, cutoff),
      ),
    );
}
