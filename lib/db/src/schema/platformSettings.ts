import { pgTable, integer, boolean, timestamp } from "drizzle-orm/pg-core";

// Singleton row (id = 1) — platform-wide economy knobs editable from admin UI.
export const platformSettingsTable = pgTable("platform_settings", {
  id: integer("id").primaryKey().default(1),
  // Weekly interest on internal (blue) balance — hundredth-bps (20 = 0.20%/week).
  weeklyInterestRateHbps: integer("weekly_interest_rate_hbps")
    .notNull()
    .default(20),
  guestCreditLimitLzt: integer("guest_credit_limit_lzt").notNull().default(500),
  defaultCreditLimitLzt: integer("default_credit_limit_lzt")
    .notNull()
    .default(3000),
  welcomeBonusLzt: integer("welcome_bonus_lzt").notNull().default(0),
  interestEnabled: boolean("interest_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type PlatformSettings = typeof platformSettingsTable.$inferSelect;
