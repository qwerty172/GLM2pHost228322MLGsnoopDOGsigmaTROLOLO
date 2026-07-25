import {
  pgTable,
  text,
  uuid,
  timestamp,
  numeric,
  integer,
  boolean,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { gamesTable } from "./games";

// A single weekly schedule slot: from `startMin` to `endMin` minutes-from-midnight,
// on the given `day` (0 = Sunday … 6 = Saturday). All times are UTC.
// Slots are interpreted in OR fashion: the host is "available" if NOW falls
// in any slot. When scheduleMode = "always", the schedule array is ignored.
export const scheduleSlotSchema = z.object({
  day: z.number().int().min(0).max(6),
  startMin: z.number().int().min(0).max(1440),
  endMin: z.number().int().min(0).max(1440),
});
export type ScheduleSlot = z.infer<typeof scheduleSlotSchema>;
export const scheduleSchema = z.array(scheduleSlotSchema).max(50);

export const hostsTable = pgTable("hosts", {
  id: uuid("id").primaryKey().defaultRandom(),
  hostToken: text("host_token").notNull().unique(),
  displayName: text("display_name").notNull(),
  // Two LZT buckets (integer LZT, 1 USDT = 200 LZT). See players schema for
  // a fuller description of the blue (internal=balance) / green
  // (withdrawable=cash) split.
  internalBalanceLzt: integer("internal_balance_lzt").notNull().default(0),
  withdrawableBalanceLzt: integer("withdrawable_balance_lzt")
    .notNull()
    .default(0),
  // Economy v1 — credit aggregates, tariff drivers, interest accumulator.
  creditDebtLzt: integer("credit_debt_lzt").notNull().default(0),
  creditReceivableLzt: integer("credit_receivable_lzt")
    .notNull()
    .default(0),
  pendingInterestFractionLzt: integer("pending_interest_fraction_lzt")
    .notNull()
    .default(0),
  // Same role as players.interestSampleLzt — snapshot of internalBalanceLzt
  // at the end of the previous interest tick. avg ≈ (sample + current)/2.
  interestSampleLzt: integer("interest_sample_lzt").notNull().default(0),
  lifetimeDepositUsdtCents: integer("lifetime_deposit_usdt_cents")
    .notNull()
    .default(0),
  maxDepositUsdtCents: integer("max_deposit_usdt_cents").notNull().default(0),
  maxWithdrawalUsdtCents: integer("max_withdrawal_usdt_cents")
    .notNull()
    .default(0),
  premiumUntil: timestamp("premium_until", { withTimezone: true }),
  kycVerified: boolean("kyc_verified").notNull().default(false),
  hasDefault: boolean("has_default").notNull().default(false),
  // Host service credit policy — when > 0, hosts give new players up to this
  // many minutes on credit when the player can't afford a tick (capped by
  // creditMaxLztPerPlayer per individual borrower).
  creditMinutesPerNewPlayer: integer("credit_minutes_per_new_player")
    .notNull()
    .default(10),
  creditMaxLztPerPlayer: integer("credit_max_lzt_per_player")
    .notNull()
    .default(12_000), // ~$60 @ 200 LZT/USDT

  // -----------------------------------------------------------------
  // Host "offer" config — what this host streams and on what terms.
  // -----------------------------------------------------------------

  // DEPRECATED — use hostGamesTable instead (multi-game library per host).
  // Kept for backward compat with host agents < v2 that still read these
  // fields directly. New code must read from host_games table.
  gameId: uuid("game_id").references(() => gamesTable.id, {
    onDelete: "set null",
  }),
  // DEPRECATED — use host_games.app_path
  boundAppPath: text("bound_app_path").notNull().default(""),
  // DEPRECATED — use host_games.bound_url
  boundUrl: text("bound_url").notNull().default(""),
  // DEPRECATED — use games.title joined via host_games
  boundAppLabel: text("bound_app_label").notNull().default(""),
  description: text("description").notNull().default(""),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),

  launchPriceUsd: numeric("launch_price_usd", { precision: 18, scale: 6 })
    .notNull()
    .default("0"),
  minutePriceUsd: numeric("minute_price_usd", { precision: 18, scale: 6 })
    .notNull()
    .default("0.04"),

  scheduleMode: text("schedule_mode").notNull().default("always"),
  scheduleJson: jsonb("schedule_json")
    .$type<ScheduleSlot[]>()
    .notNull()
    .default([]),

  streamPlatform: text("stream_platform").notNull().default(""),
  streamUrl: text("stream_url").notNull().default(""),
  streamKey: text("stream_key").notNull().default(""),

  // How many games this host has contributed to the catalog via approved submissions.
  // Incremented on submission approval. Reserved for future reward mechanics.
  gamesContributed: integer("games_contributed").notNull().default(0),
  // Platform administrator flag. When true, this host can approve/reject
  // game submissions and edit catalog metadata.
  isAdmin: integer("is_admin").notNull().default(0),
  // Latest submission outcome notification (pending / approved / rejected).
  // Set by the admin moderation flow so the host dashboard can surface the result.
  lastSubmissionStatus: text("last_submission_status"),
  // Human-readable note about the last submission outcome (approval note or rejection reason).
  lastSubmissionNote: text("last_submission_note").notNull().default(""),

  // Agent signing key — public half of the Ed25519 key pair generated by the
  // host agent on first run. Stored as hex-encoded DER (SubjectPublicKeyInfo).
  // Null until the host binds their agent via POST /api/auth/bind-agent-key.
  agentPubkey: text("agent_pubkey"),

  // Set to true when this host was auto-provisioned by the platform on a VDS
  // owned by a quota owner. VDS hosts are separated from live hosts in the catalog.
  isVds: integer("is_vds").notNull().default(0),

  // PC hardware specifications reported by the host agent.
  // Shape: { gpu: string; cpu: string; ramGb: number; cpuCores?: number; downloadMbps?: number; uploadMbps?: number }
  pcSpecs: jsonb("pc_specs").$type<{
    gpu: string;
    cpu: string;
    ramGb: number;
    cpuCores?: number;
    downloadMbps?: number;
    uploadMbps?: number;
  } | null>(),

  // RTT from host agent to the API server, measured during heartbeat (ms).
  // Null until the first heartbeat that includes a ping measurement.
  pingMs: integer("ping_ms"),
  // Aggregated player ratings (updated when a session is rated).
  ratingAvg: numeric("rating_avg", { precision: 4, scale: 2 }),
  ratingCount: integer("rating_count").notNull().default(0),

  // Set by the schedule watchdog when it auto-deactivates a "scheduled" host
  // that didn't come online within 10 minutes of its window start. Cleared
  // whenever the hoster saves their config again (manual re-enable).
  // Null when the schedule was never auto-disabled (or was cleared since).
  scheduleAutoDisabledReason: text("schedule_auto_disabled_reason"),
  scheduleAutoDisabledAt: timestamp("schedule_auto_disabled_at", {
    withTimezone: true,
  }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => ({
  // Online-filter / heartbeat scans: hosts lastSeenAt within N minutes.
  lastSeenAtIdx: index("hosts_last_seen_at_idx").on(t.lastSeenAt),
}));

export const insertHostSchema = createInsertSchema(hostsTable).omit({
  id: true,
  createdAt: true,
  lastSeenAt: true,
});
export type InsertHost = z.infer<typeof insertHostSchema>;
export type Host = typeof hostsTable.$inferSelect;
