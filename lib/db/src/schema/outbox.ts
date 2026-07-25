import {
  pgTable,
  uuid,
  timestamp,
  integer,
  text,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

export const outboxTable = pgTable(
  "outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: text("aggregate_id").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull().default({}),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [
    index("outbox_status_idx").on(t.status),
    index("outbox_created_at_idx").on(t.createdAt),
  ],
);

export type OutboxRow = typeof outboxTable.$inferSelect;
