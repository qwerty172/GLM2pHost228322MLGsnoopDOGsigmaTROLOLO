import {
  pgTable,
  uuid,
  integer,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sessionsTable } from "./sessions";
import { playersTable } from "./players";
import { hostsTable } from "./hosts";

export const sessionRatingsTable = pgTable(
  "session_ratings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessionsTable.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => playersTable.id, { onDelete: "cascade" }),
    hostId: uuid("host_id")
      .notNull()
      .references(() => hostsTable.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    comment: text("comment").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    sessionPlayerUniq: uniqueIndex("session_ratings_session_player_idx").on(
      t.sessionId,
      t.playerId,
    ),
  }),
);

export type SessionRating = typeof sessionRatingsTable.$inferSelect;
