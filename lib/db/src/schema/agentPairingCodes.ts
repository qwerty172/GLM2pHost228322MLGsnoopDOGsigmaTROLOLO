import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { hostsTable } from "./hosts";

export const agentPairingCodesTable = pgTable("agent_pairing_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  hostId: uuid("host_id")
    .notNull()
    .references(() => hostsTable.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  agentPubkey: text("agent_pubkey"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type AgentPairingCode = typeof agentPairingCodesTable.$inferSelect;
