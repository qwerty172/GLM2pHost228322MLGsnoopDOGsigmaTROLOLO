import {
  pgTable,
  text,
  uuid,
  timestamp,
  numeric,
} from "drizzle-orm/pg-core";

export const playersTable = pgTable("players", {
  id: uuid("id").primaryKey().defaultRandom(),
  playerToken: text("player_token").notNull().unique(),
  displayName: text("display_name").notNull(),
  creditBalance: numeric("credit_balance", { precision: 18, scale: 6 })
    .notNull()
    .default("0"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Player = typeof playersTable.$inferSelect;
