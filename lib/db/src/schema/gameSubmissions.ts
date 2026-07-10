import {
  pgTable,
  text,
  uuid,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { gamesTable } from "./games";
import { hostsTable } from "./hosts";

// A host's request to add a new game to the platform catalog.
// Status flow: pending → approved (game created) | rejected.
// On approval the resulting game row is linked via approvedGameId.
export const gameSubmissionsTable = pgTable("game_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Host who submitted the request.
  hostId: uuid("host_id")
    .notNull()
    .references(() => hostsTable.id, { onDelete: "restrict" }),
  // Moderation status.
  status: text("status").notNull().default("pending"),

  // -- Proposed game metadata (filled by submitter) --
  title: text("title").notNull(),
  // Optional slug. If blank the platform generates one on approve.
  slug: text("slug").notNull().default(""),
  category: text("category").notNull().default(""),
  genres: jsonb("genres").$type<string[]>().notNull().default([]),
  description: text("description").notNull().default(""),
  // External URL or object-storage path (/api/storage/objects/...).
  coverImageUrl: text("cover_image_url").notNull().default(""),
  // 'native' = desktop host agent required; 'browser' = browser-hostable.
  kind: text("kind").notNull().default("native"),
  // Required when kind = 'browser'.
  defaultBrowserUrl: text("default_browser_url").notNull().default(""),
  steamAppId: text("steam_app_id"),

  // -- Review fields (filled by admin) --
  reviewerId: uuid("reviewer_id").references(() => hostsTable.id, {
    onDelete: "set null",
  }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  // FK to the game row created when this submission was approved.
  approvedGameId: uuid("approved_game_id").references(() => gamesTable.id, {
    onDelete: "set null",
  }),

  // Optional host config saved while the submission is pending.
  // On approval the platform auto-creates a library entry from this.
  pendingHostConfig: jsonb("pending_host_config").$type<{
    pricePerMinuteLzt: number;
    appPath: string;
    boundUrl: string;
    launchArgs: string;
  }>(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => ({
  hostIdx: index("game_submissions_host_idx").on(t.hostId),
  statusIdx: index("game_submissions_status_idx").on(t.status),
}));

export type GameSubmission = typeof gameSubmissionsTable.$inferSelect;
