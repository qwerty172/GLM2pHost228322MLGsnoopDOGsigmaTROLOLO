import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { gamesTable } from "./games";

// Quotas — re-usable "preset contracts" that any user can create and attach
// to a hosting session. A quota tweaks the standard money flow (player → host
// minus platform fee) in one of two ways:
//
//   - royalty: takes a slice of every minute and pays it to the quota's owner.
//              Useful when the host streams content (mod, account, training)
//              produced by someone else.
//   - sponsor: the owner pre-funds an escrow at publish time and the platform
//              tops up the host and/or the player while the session runs.
//              Useful for paid playtests / promo budgets.
//
// All amounts are integer LZT (1 USDT = 200 LZT) to match the wallet.
export const quotasTable = pgTable(
  "quotas",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // The user that created (and owns) the quota. We accept either a host
    // or a player as the owner, since both have a green/blue LZT wallet.
    ownerType: text("owner_type").notNull(), // "host" | "player"
    ownerId: uuid("owner_id").notNull(),

    kind: text("kind").notNull(), // "royalty" | "sponsor"
    // draft → just created, can edit freely
    // active → published, attachable to sessions
    // paused → owner-paused, sessions get no quota benefit but stay attached
    // exhausted → sponsor budget hit 0
    // expired → end_at passed
    // closed → owner closed it manually; any remaining escrow refunded
    status: text("status").notNull().default("draft"),

    title: text("title").notNull(),
    description: text("description").notNull().default(""),

    // Optional binding: when set, the quota can only be attached to sessions
    // whose host's gameId matches. NULL → applies to any game.
    gameId: uuid("game_id").references(() => gamesTable.id, {
      onDelete: "set null",
    }),

    // public → shows up in the public list, no code needed.
    // private → hidden, requires the access code when attaching.
    visibility: text("visibility").notNull().default("public"),
    accessCode: text("access_code"),

    minSessionMinutes: integer("min_session_minutes"),
    maxSessionMinutes: integer("max_session_minutes"),

    // ---- Minimum PC specs required on the host's machine ----
    // All optional (NULL = no requirement). Used to prevent a quota for a
    // demanding game (e.g. Cyberpunk) from attaching to an underpowered host.
    minGpuVram: integer("min_gpu_vram"),     // GB VRAM
    minCpuCores: integer("min_cpu_cores"),   // logical cores
    minRamGb: integer("min_ram_gb"),         // GB RAM
    minDownloadMbps: integer("min_download_mbps"), // Mbps
    minUploadMbps: integer("min_upload_mbps"),     // Mbps

    // ---- Recommended PC specs (optional, stricter tier) ----
    // When set, a host must clear ALL of these (in addition to the min*
    // floor) to count as "above recommended" for this quota. NULL = no
    // recommended tier defined, only the min* floor applies.
    recGpuVram: integer("rec_gpu_vram"),
    recCpuCores: integer("rec_cpu_cores"),
    recRamGb: integer("rec_ram_gb"),
    recDownloadMbps: integer("rec_download_mbps"),
    recUploadMbps: integer("rec_upload_mbps"),
    // "min" → any host meeting the min* floor can attach (default).
    // "recommended" → only hosts clearing every rec* threshold can attach.
    requiredTier: text("required_tier").notNull().default("min"),

    startAt: timestamp("start_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    endAt: timestamp("end_at", { withTimezone: true }),

    // ---- Sponsor-only fields ----
    // Total LZT escrow budget set at publish time (snapshot of the initial
    // deposit). escrowRemainingLzt is mutated as the platform pays out.
    budgetLzt: integer("budget_lzt"),
    escrowRemainingLzt: integer("escrow_remaining_lzt"),
    sponsorHostPerMinuteLzt: integer("sponsor_host_per_minute_lzt"),
    sponsorPlayerPerMinuteLzt: integer("sponsor_player_per_minute_lzt"),

    // ---- Royalty-only fields ----
    // percent → 0..100, applied to the per-minute amount.
    // fixed_per_minute → integer LZT, taken every minute.
    royaltyBasis: text("royalty_basis"),
    royaltyValue: integer("royalty_value"),
    // player → reduce what the player keeps (royalty is added to the debit).
    // host_share → take it out of the host's payout.
    royaltySource: text("royalty_source"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("quotas_owner_idx").on(t.ownerType, t.ownerId),
    index("quotas_visibility_idx").on(t.visibility, t.status),
    index("quotas_game_idx").on(t.gameId),
  ],
);

export type Quota = typeof quotasTable.$inferSelect;

// Per-session attachment row, keeps running totals so the quota's "stats"
// page is a single query.
export const quotaSessionsTable = pgTable(
  "quota_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quotaId: uuid("quota_id")
      .notNull()
      .references(() => quotasTable.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").notNull(),
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
  ],
);

export type QuotaSession = typeof quotaSessionsTable.$inferSelect;
