import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";

export const verifierProviderEnum = pgEnum("verifier_provider", [
  "telegram",
  "discord",
]);

export const userTypeEnum = pgEnum("user_type_verifier", ["host", "player"]);

/**
 * Stores the mapping between a platform user and their bot account
 * on each messaging provider (Telegram / Discord).
 */
export const verifierLinksTable = pgTable("verifier_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  userType: userTypeEnum("user_type").notNull(),
  provider: verifierProviderEnum("provider").notNull(),
  /** Provider-side user ID (Telegram chat_id / Discord user snowflake). */
  providerUserId: text("provider_user_id").notNull(),
  /** Display name / username at link time, for UI only. */
  providerUsername: text("provider_username"),
  active: boolean("active").notNull().default(true),
  linkedAt: timestamp("linked_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Short-lived tokens generated when a user starts the link flow.
 * The user sends this token to the bot which calls confirmLinkToken().
 */
export const verifierLinkTokensTable = pgTable("verifier_link_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  token: text("token").notNull().unique(),
  userId: uuid("user_id").notNull(),
  userType: userTypeEnum("user_type").notNull(),
  provider: verifierProviderEnum("provider").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  /** Consumed = already used; prevents replay. */
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
});

/**
 * Dual-OTP challenges. Codes are stored as a JSON object keyed by provider.
 * verifiedProviders is a JSON array of providers whose code was accepted.
 */
export const verifierChallengesTable = pgTable("verifier_challenges", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  userType: userTypeEnum("user_type").notNull(),
  purpose: text("purpose").notNull().default("explicit"),
  /** { telegram: "123456", discord: "789012" } */
  codes: text("codes").notNull(), // JSON string
  /** ["telegram"] after first code accepted */
  verifiedProviders: text("verified_providers").notNull().default("[]"), // JSON array
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
