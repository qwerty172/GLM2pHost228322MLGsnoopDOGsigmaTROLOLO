import {
  pgTable,
  uuid,
  timestamp,
  integer,
  text,
  index,
} from "drizzle-orm/pg-core";
import { sessionsTable } from "./sessions";

export const sessionMetricsTable = pgTable(
  "session_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessionsTable.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    sampledAt: timestamp("sampled_at", { withTimezone: true }).notNull(),
    rttMs: integer("rtt_ms"),
    bitrateKbps: integer("bitrate_kbps"),
    fps: integer("fps"),
    packetLossPct: integer("packet_loss_pct"),
    framesDropped: integer("frames_dropped"),
    iceCandidateType: text("ice_candidate_type"),
    jitterMs: integer("jitter_ms"),
  },
  (t) => [
    index("session_metrics_session_idx").on(t.sessionId),
    index("session_metrics_sampled_at_idx").on(t.sampledAt),
  ],
);

export type SessionMetric = typeof sessionMetricsTable.$inferSelect;
