import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import {
  db,
  hostsTable,
  sessionsTable,
  withdrawalsTable,
} from "@workspace/db";
import {
  RegisterHostBody,
  GetHostResponse,
  GetHostParams,
  ListHostSessionsParams,
  ListHostSessionsResponseItem,
  GetHostStatsParams,
  GetHostStatsResponse,
  GetHostActivityParams,
  GetHostActivityResponseItem,
} from "@workspace/api-zod";
import { generateToken } from "../lib/tokens";
import { ensureDepositAddressesForOwner } from "../lib/walletOwner";

const router: IRouter = Router();

function serializeHost(h: typeof hostsTable.$inferSelect) {
  return {
    ...h,
    creditBalance: Number(h.creditBalance),
  };
}

router.post("/hosts/register", async (req, res): Promise<void> => {
  const parsed = RegisterHostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const hostToken = generateToken();
  const [host] = await db
    .insert(hostsTable)
    .values({
      hostToken,
      displayName: parsed.data.displayName,
    })
    .returning();

  if (!host) {
    res.status(500).json({ error: "Failed to create host" });
    return;
  }

  try {
    await ensureDepositAddressesForOwner("host", host.id);
  } catch (err) {
    req.log.error({ err, hostId: host.id }, "Failed to provision host deposit addresses");
  }
  req.log.info({ hostId: host.id }, "Host registered");
  res.status(201).json(GetHostResponse.parse(serializeHost(host)));
});

router.get("/hosts/:hostToken", async (req, res): Promise<void> => {
  const params = GetHostParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [host] = await db
    .select()
    .from(hostsTable)
    .where(eq(hostsTable.hostToken, params.data.hostToken));

  if (!host) {
    res.status(404).json({ error: "Host not found" });
    return;
  }

  res.json(GetHostResponse.parse(serializeHost(host)));
});

router.get(
  "/hosts/:hostToken/sessions",
  async (req, res): Promise<void> => {
    const params = ListHostSessionsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [host] = await db
      .select()
      .from(hostsTable)
      .where(eq(hostsTable.hostToken, params.data.hostToken));

    if (!host) {
      res.status(404).json({ error: "Host not found" });
      return;
    }

    const sessions = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.hostId, host.id))
      .orderBy(desc(sessionsTable.createdAt));

    res.json(
      sessions.map((s) =>
        ListHostSessionsResponseItem.parse({
          ...s,
          ratePerMinute: Number(s.ratePerMinute),
        }),
      ),
    );
  },
);

router.get("/hosts/:hostToken/stats", async (req, res): Promise<void> => {
  const params = GetHostStatsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [host] = await db
    .select()
    .from(hostsTable)
    .where(eq(hostsTable.hostToken, params.data.hostToken));

  if (!host) {
    res.status(404).json({ error: "Host not found" });
    return;
  }

  const sessions = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.hostId, host.id));

  const totalSessions = sessions.length;
  const activeSessions = sessions.filter((s) => s.status === "active").length;

  let totalMinutesStreamed = 0;
  for (const s of sessions) {
    if (s.startedAt) {
      const end = s.endedAt ?? new Date();
      const minutes = Math.max(
        0,
        Math.floor(
          (end.getTime() - new Date(s.startedAt).getTime()) / 60000,
        ),
      );
      totalMinutesStreamed += minutes;
    }
  }

  // Pricing: $0.04 per minute (placeholder until wallet task implements real billing).
  const RATE_PER_MINUTE = 0.04;
  const lifetimeEarnings = totalMinutesStreamed * RATE_PER_MINUTE;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  let minutes7d = 0;
  for (const s of sessions) {
    if (s.startedAt && new Date(s.startedAt) >= sevenDaysAgo) {
      const end = s.endedAt ?? new Date();
      minutes7d += Math.max(
        0,
        Math.floor(
          (end.getTime() - new Date(s.startedAt).getTime()) / 60000,
        ),
      );
    }
  }
  const earnings7d = minutes7d * RATE_PER_MINUTE;

  res.json(
    GetHostStatsResponse.parse({
      totalSessions,
      activeSessions,
      totalMinutesStreamed,
      lifetimeEarnings,
      earnings7d,
      creditBalance: Number(host.creditBalance),
    }),
  );
});

router.get(
  "/hosts/:hostToken/activity",
  async (req, res): Promise<void> => {
    const params = GetHostActivityParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [host] = await db
      .select()
      .from(hostsTable)
      .where(eq(hostsTable.hostToken, params.data.hostToken));

    if (!host) {
      res.status(404).json({ error: "Host not found" });
      return;
    }

    const sessions = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.hostId, host.id))
      .orderBy(desc(sessionsTable.createdAt))
      .limit(25);

    const withdrawals = await db
      .select()
      .from(withdrawalsTable)
      .where(
        and(
          eq(withdrawalsTable.ownerType, "host"),
          eq(withdrawalsTable.ownerId, host.id),
        ),
      )
      .orderBy(desc(withdrawalsTable.requestedAt))
      .limit(25);

    type Item = {
      id: string;
      kind: string;
      title: string;
      subtitle: string | null;
      amount: number | null;
      currency: string | null;
      timestamp: Date;
    };
    const items: Item[] = [];

    for (const s of sessions) {
      if (s.startedAt) {
        items.push({
          id: `sess-start-${s.id}`,
          kind: "session_started",
          title: `${s.appName} session started`,
          subtitle: `${s.resolution} @ ${s.bitrateKbps} kbps`,
          amount: null,
          currency: null,
          timestamp: new Date(s.startedAt),
        });
      }
      if (s.endedAt) {
        let minutes = 0;
        if (s.startedAt) {
          minutes = Math.max(
            0,
            Math.floor(
              (new Date(s.endedAt).getTime() -
                new Date(s.startedAt).getTime()) /
                60000,
            ),
          );
        }
        items.push({
          id: `sess-end-${s.id}`,
          kind: "session_ended",
          title: `${s.appName} session ended`,
          subtitle: minutes > 0 ? `${minutes} min streamed` : null,
          amount: minutes > 0 ? minutes * 0.04 : null,
          currency: minutes > 0 ? "USD" : null,
          timestamp: new Date(s.endedAt),
        });
      }
    }

    for (const w of withdrawals) {
      items.push({
        id: `wd-req-${w.id}`,
        kind: "withdrawal_requested",
        title: `Withdrawal requested`,
        subtitle: `${w.currency} → ${w.address.slice(0, 10)}...`,
        amount: Number(w.amount),
        currency: w.currency,
        timestamp: new Date(w.requestedAt),
      });
      if (w.completedAt && w.status === "completed") {
        items.push({
          id: `wd-done-${w.id}`,
          kind: "withdrawal_completed",
          title: `Withdrawal completed`,
          subtitle: w.currency,
          amount: Number(w.amount),
          currency: w.currency,
          timestamp: new Date(w.completedAt),
        });
      }
    }

    items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    res.json(
      items
        .slice(0, 30)
        .map((i) =>
          GetHostActivityResponseItem.parse({
            ...i,
            timestamp: i.timestamp.toISOString(),
          }),
        ),
    );
  },
);

export default router;
