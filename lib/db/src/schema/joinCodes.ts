import {
  pgTable,
  text,
  uuid,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { sessionsTable } from "./sessions";

/** Short-lived join codes that map to a session without exposing playerToken in URLs. */
export const joinCodesTable = pgTable(
  "join_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** URL-safe short code (6–8 uppercase alphanumeric). */
    code: text("code").notNull().unique(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessionsTable.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("join_codes_session_idx").on(t.sessionId)],
);

export type JoinCode = typeof joinCodesTable.$inferSelect;
