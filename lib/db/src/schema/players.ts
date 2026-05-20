import { pgTable, text, uuid, timestamp, integer } from "drizzle-orm/pg-core";

export const playersTable = pgTable("players", {
  id: uuid("id").primaryKey().defaultRandom(),
  playerToken: text("player_token").notNull().unique(),
  displayName: text("display_name").notNull(),
  // Two LZT buckets (integer LZT, 1 USDT = 200 LZT).
  //   internal   → "синий" wallet/card balance. Can only be spent inside the
  //                platform (paying hosts, future Биржа/Форум/Кредиты).
  //   withdrawable → "зелёный" banknote balance. Can be converted back to
  //                crypto at 200 LZT = 1 USDT and withdrawn.
  internalBalanceLzt: integer("internal_balance_lzt").notNull().default(0),
  withdrawableBalanceLzt: integer("withdrawable_balance_lzt")
    .notNull()
    .default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Player = typeof playersTable.$inferSelect;
