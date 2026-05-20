import { Router, type IRouter } from "express";
import { and, desc, eq, gt, ne, sql } from "drizzle-orm";
import {
  db,
  hostsTable,
  sessionsTable,
  billingEventsTable,
  withdrawalsTable,
} from "@workspace/db";
import {
  ListPublicHostsResponse,
  GetPublicStatsResponse,
} from "@workspace/api-zod";
import { isHostAvailableNow } from "../lib/schedule";

const router: IRouter = Router();

function urlHostname(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

// Public, anonymous-safe list of hosts currently offering a session.
// A "live" host is one with at least one non-ended session and whose schedule
// says it's open right now. We surface only display-safe fields.
router.get("/hosts", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      session: sessionsTable,
      host: hostsTable,
    })
    .from(sessionsTable)
    .innerJoin(hostsTable, eq(sessionsTable.hostId, hostsTable.id))
    .where(ne(sessionsTable.status, "ended"))
    .orderBy(desc(sessionsTable.createdAt));

  const now = new Date();
  const seen = new Set<string>();
  const items = [];
  for (const { host: h, session: s } of rows) {
    if (seen.has(h.id)) continue;
    seen.add(h.id);
    const available = isHostAvailableNow(
      h.scheduleMode,
      h.scheduleJson ?? [],
      now,
    );
    const minutePrice = Number(h.minutePriceUsd);
    items.push({
      id: h.id,
      displayName: h.displayName,
      boundAppLabel: h.boundAppLabel || s.appName,
      boundUrlHost: urlHostname(h.boundUrl),
      tags: h.tags ?? [],
      pricePerHourUsd: Number.isFinite(minutePrice) ? minutePrice * 60 : 0,
      launchPriceUsd: Number(h.launchPriceUsd),
      minutePriceUsd: minutePrice,
      status: available
        ? s.status === "active"
          ? "online"
          : "online"
        : "scheduled",
      playerToken: s.playerToken,
    });
  }

  res.json(ListPublicHostsResponse.parse(items));
});

// Platform stats for the public landing hero strip. Cheap aggregate queries —
// safe to call on every page-load (we don't cache today).
router.get("/stats", async (_req, res): Promise<void> => {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

  // "Hosts online" = hosts whose agent has phoned home within the last 5 min,
  // OR which currently have an active session. This is forgiving for the
  // early stage where many hosts may not yet maintain a live heartbeat.
  const [{ count: liveByHeartbeat }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(hostsTable)
    .where(gt(hostsTable.lastSeenAt, fiveMinAgo));

  const [{ count: liveBySession }] = await db
    .select({
      count: sql<number>`count(distinct ${sessionsTable.hostId})::int`,
    })
    .from(sessionsTable)
    .where(ne(sessionsTable.status, "ended"));

  // Active sessions = pending or active (not ended).
  const [{ count: activeSessions }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sessionsTable)
    .where(and(ne(sessionsTable.status, "ended")));

  // Total paid out = sum of completed host withdrawals, in cents. We round
  // because withdrawal amounts are stored with 6-decimal precision.
  const [{ totalCents }] = await db
    .select({
      totalCents: sql<number>`coalesce(round(sum(${withdrawalsTable.amount}) * 100)::int, 0)`,
    })
    .from(withdrawalsTable)
    .where(
      and(
        eq(withdrawalsTable.ownerType, "host"),
        eq(withdrawalsTable.status, "completed"),
      ),
    );

  // Fallback: if no withdrawals yet, show lifetime host credit accrued —
  // gives early visitors a non-zero figure that still reflects real activity.
  let paidCents = Number(totalCents) || 0;
  if (paidCents === 0) {
    const [{ accrued }] = await db
      .select({
        accrued: sql<number>`coalesce(round(sum(${billingEventsTable.hostCredit}) * 100)::int, 0)`,
      })
      .from(billingEventsTable);
    paidCents = Number(accrued) || 0;
  }

  res.json(
    GetPublicStatsResponse.parse({
      hostsOnline: Math.max(
        Number(liveByHeartbeat) || 0,
        Number(liveBySession) || 0,
      ),
      activeSessions: Number(activeSessions) || 0,
      totalPaidOutCents: paidCents,
    }),
  );
});

export default router;
