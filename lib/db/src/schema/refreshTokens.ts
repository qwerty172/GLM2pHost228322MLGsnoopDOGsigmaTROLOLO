import {
  pgTable,
  uuid,
  timestamp,
  text,
  index,
} from "drizzle-orm/pg-core";

export const refreshTokensTable = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    userType: text("user_type").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("refresh_tokens_user_idx").on(t.userId, t.userType),
    index("refresh_tokens_expires_idx").on(t.expiresAt),
  ],
);

export type RefreshToken = typeof refreshTokensTable.$inferSelect;
