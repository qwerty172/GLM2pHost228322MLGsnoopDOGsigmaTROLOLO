import {
  pgTable,
  uuid,
  timestamp,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { quotasTable } from "./quotas";
import { sessionsTable } from "./sessions";

// Per-session attachment row, keeps running totals so the quota's "stats"
// page is a single query. Split from quotas.ts to avoid a circular import
// with sessions (sessions.quotaId → quotas, quota_sessions.sessionId → sessions).
export const quotaSessionsTable = pgTable(
  "quota_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quotaId: uuid("quota_id")
      .notNull()
      .references(() => quotasTable.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessionsTable.id, { onDelete: "cascade" }),
    attachedAt: timestamp("attached_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    detachedAt: timestamp("detached_at", { withTimezone: true }),
    totalRoyaltyLzt: integer("total_royalty_lzt").notNull().default(0),
    totalSponsorHostLzt: integer("total_sponsor_host_lzt")
      .notNull()
      .default(0),
    totalSponsorPlayerLzt: integer("total_sponsor_player_lzt")
      .notNull()
      .default(0),
    minutesBilled: integer("minutes_billed").notNull().default(0),
  },
  (t) => [
    index("quota_sessions_quota_idx").on(t.quotaId),
    index("quota_sessions_session_idx").on(t.sessionId),
    // One attachment row per session (a session binds to at most one quota).
    uniqueIndex("quota_sessions_session_unique_idx").on(t.sessionId),
  ],
);

export type QuotaSession = typeof quotaSessionsTable.$inferSelect;
