import { sql } from "drizzle-orm";
import { pgTable, text, uniqueIndex, uuid, timestamp } from "drizzle-orm/pg-core";
import { hostsTable } from "./hosts";

export const agentPairingCodesTable = pgTable(
  "agent_pairing_codes",
  {
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
  },
  (t) => [
    // Active pairing codes must be globally unique — redeem picks by code only.
    uniqueIndex("agent_pairing_codes_active_code_unique_idx")
      .on(t.code)
      .where(sql`${t.usedAt} is null`),
  ],
);

export type AgentPairingCode = typeof agentPairingCodesTable.$inferSelect;
