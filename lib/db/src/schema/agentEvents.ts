import {
  pgTable,
  uuid,
  timestamp,
  text,
  index,
} from "drizzle-orm/pg-core";
import { hostsTable } from "./hosts";

// Telemetry events reported by the host agent (Electron app on the host's
// Windows PC). The agent has no reliable local feedback channel — windows
// close, users don't read logs — so every noteworthy event (startup, fatal
// error, injector failure) is pushed here and surfaced on the Host Dashboard.
export const agentEventsTable = pgTable(
  "agent_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hostId: uuid("host_id")
      .notNull()
      .references(() => hostsTable.id, { onDelete: "cascade" }),
    // "info" | "warn" | "error" | "fatal"
    level: text("level").notNull(),
    // Free-form message from the agent, capped server-side at 2000 chars.
    message: text("message").notNull(),
    // Agent build/version string, e.g. "0.1.0" — helps spot stale installs.
    agentVersion: text("agent_version"),
    // When the event happened on the agent's machine (client clock).
    occurredAt: timestamp("occurred_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("agent_events_host_idx").on(t.hostId, t.createdAt),
  ],
);

export type AgentEvent = typeof agentEventsTable.$inferSelect;
