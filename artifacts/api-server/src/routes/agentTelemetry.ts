// Agent telemetry: the host agent pushes noteworthy events (startup, fatal
// errors, injector failures) here so they survive even when the agent dies
// silently on the host's machine. Surfaced on the Host Dashboard and in
// server logs — no more "window closed, no trace of what happened".

import { Router, type IRouter } from "express";
import type { Request } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { db, hostsTable, agentEventsTable } from "@workspace/db";
import { rateLimit, ipKey, guardAndTrackFailures } from "../lib/rateLimit";
import { hostTokenFromRequest } from "../lib/requestToken";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Key strictly on header-provided tokens (Authorization / X-Host-Token /
// X-User-Token). Never body/query fields — those are attacker-controlled and
// would allow bucket-shifting to bypass the limit. No token → shared IP
// bucket (unauthenticated traffic gets 401 anyway).
function headerTokenKey(req: Request): string {
  return hostTokenFromRequest(req) ?? ipKey(req);
}

// Path-token key for the dashboard read route: after the @me middleware the
// path param holds the real token, so each host polls its own bucket.
function pathTokenKey(req: Request): string {
  const tok = (req.params as { hostToken?: string }).hostToken;
  return tok && tok.length >= 8 ? tok : ipKey(req);
}

const telemetryLimiter = rateLimit({
  scope: "agent:telemetry",
  windowMs: 60_000,
  max: 60,
  keyFn: headerTokenKey,
});

const agentEventsReadLimiter = rateLimit({
  scope: "agent:events:read",
  windowMs: 60_000,
  max: 120,
  keyFn: pathTokenKey,
});

const LEVELS = ["info", "warn", "error", "fatal"] as const;

const TelemetryBody = z.object({
  agentVersion: z.string().max(64).optional(),
  events: z
    .array(
      z.object({
        level: z.enum(LEVELS),
        message: z.string().min(1).max(4000),
        // Client clock — optional ISO timestamp of when it happened.
        occurredAt: z.iso.datetime({ offset: true }).optional(),
      }),
    )
    .min(1)
    .max(20),
});

/** Events kept per host — older rows are pruned on every insert. */
const KEEP_PER_HOST = 200;

router.post(
  "/agent-telemetry",
  telemetryLimiter,
  guardAndTrackFailures("agent:telemetry"),
  async (req, res): Promise<void> => {
    const hostToken = hostTokenFromRequest(req);
    if (!hostToken) {
      res.status(401).json({ error: "X-Host-Token header required" });
      return;
    }

    const parsed = TelemetryBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [host] = await db
      .select({ id: hostsTable.id, displayName: hostsTable.displayName })
      .from(hostsTable)
      .where(eq(hostsTable.hostToken, hostToken));
    if (!host) {
      res.status(404).json({ error: "Host not found" });
      return;
    }

    const { agentVersion, events } = parsed.data;

    await db.insert(agentEventsTable).values(
      events.map((e) => ({
        hostId: host.id,
        level: e.level,
        // Hard cap even beyond zod: telemetry must never bloat the DB.
        message: e.message.slice(0, 2000),
        agentVersion: agentVersion ?? null,
        occurredAt: e.occurredAt ? new Date(e.occurredAt) : null,
      })),
    );

    // Mirror error/fatal into the server log so they show up in workflow /
    // deployment logs without opening the dashboard.
    for (const e of events) {
      if (e.level === "error" || e.level === "fatal") {
        logger.warn(
          {
            hostId: host.id,
            hostName: host.displayName,
            agentVersion,
            agentLevel: e.level,
          },
          `[agent-telemetry] ${e.message.slice(0, 500)}`,
        );
      }
    }

    // Prune: keep only the newest KEEP_PER_HOST rows for this host.
    await db.execute(sql`
      DELETE FROM agent_events
      WHERE host_id = ${host.id}
        AND id NOT IN (
          SELECT id FROM agent_events
          WHERE host_id = ${host.id}
          ORDER BY created_at DESC, id DESC
          LIMIT ${KEEP_PER_HOST}
        )
    `);

    res.json({ ok: true, stored: events.length });
  },
);

const GetAgentEventsParams = z.object({
  hostToken: z.string().min(8),
});

// Dashboard: recent agent events for the authenticated host.
// Path uses :hostToken so the standard `@me` + X-User-Token substitution works.
router.get(
  "/hosts/:hostToken/agent-events",
  agentEventsReadLimiter,
  guardAndTrackFailures("agent:events:read"),
  async (req, res): Promise<void> => {
    const params = GetAgentEventsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [host] = await db
      .select({ id: hostsTable.id })
      .from(hostsTable)
      .where(eq(hostsTable.hostToken, params.data.hostToken));
    if (!host) {
      res.status(404).json({ error: "Host not found" });
      return;
    }

    const events = await db
      .select({
        id: agentEventsTable.id,
        level: agentEventsTable.level,
        message: agentEventsTable.message,
        agentVersion: agentEventsTable.agentVersion,
        occurredAt: agentEventsTable.occurredAt,
        createdAt: agentEventsTable.createdAt,
      })
      .from(agentEventsTable)
      .where(eq(agentEventsTable.hostId, host.id))
      .orderBy(desc(agentEventsTable.createdAt))
      .limit(50);

    res.json(events);
  },
);

export default router;
