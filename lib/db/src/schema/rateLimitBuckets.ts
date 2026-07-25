import { pgTable, text, real, integer, timestamp } from "drizzle-orm/pg-core";

export const rateLimitBucketsTable = pgTable("rate_limit_buckets", {
  key: text("key").primaryKey(),
  tokens: real("tokens").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  windowMs: integer("window_ms").notNull(),
  max: integer("max").notNull(),
});

export const rateLimitFailuresTable = pgTable("rate_limit_failures", {
  key: text("key").primaryKey(),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});
