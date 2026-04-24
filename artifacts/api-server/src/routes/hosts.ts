import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import {
  db,
  hostsTable,
  sessionsTable,
  withdrawalsTable,
  gamesTable,
  scheduleSchema,
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
  UpdateHostConfigBody,
} from "@workspace/api-zod";
import { generateToken } from "../lib/tokens";
import { ensureDepositAddressesForOwner } from "../lib/walletOwner";
import { encryptSecret } from "../lib/encryption";

const router: IRouter = Router();

// Hosts can declare any rate, including negative ("loss-leader" promos), but
// we cap the absolute value so a typo can't drain a wallet in one tick.
const PRICE_ABS_LIMIT = 100; // USD

function serializeHost(h: typeof hostsTable.$inferSelect) {
  return {
    id: h.id,
    hostToken: h.hostToken,
    displayName: h.displayName,
    creditBalance: Number(h.creditBalance),
    gameId: h.gameId,
    boundAppPath: h.boundAppPath,
    boundAppLabel: h.boundAppLabel,
    description: h.description,
    launchPriceUsd: Number(h.launchPriceUsd),
    minutePriceUsd: Number(h.minutePriceUsd),
    scheduleMode: h.scheduleMode,
    scheduleJson: h.scheduleJson ?? [],
    streamPlatform: h.streamPlatform,
    streamUrl: h.streamUrl,
    // Never echo the encrypted key back; surface only whether one is set.
    streamKeySet: (h.streamKey ?? "").length > 0,
    createdAt: h.createdAt,
    lastSeenAt: h.lastSeenAt,
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

router.patch("/hosts/:hostToken/config", async (req, res): Promise<void> => {
  const params = GetHostParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateHostConfigBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const body = parsed.data;

  // Pricing bounds (signed).
  for (const [field, value] of [
    ["launchPriceUsd", body.launchPriceUsd],
    ["minutePriceUsd", body.minutePriceUsd],
  ] as const) {
    if (value === undefined) continue;
    if (!Number.isFinite(value) || Math.abs(value) > PRICE_ABS_LIMIT) {
      res
        .status(400)
        .json({ error: `${field} must be a finite number with |value| ≤ ${PRICE_ABS_LIMIT}` });
      return;
    }
  }

  // Schedule mode + slot validation.
  if (body.scheduleMode && !["always", "scheduled"].includes(body.scheduleMode)) {
    res.status(400).json({ error: "scheduleMode must be 'always' or 'scheduled'" });
    return;
  }
  if (body.scheduleJson !== undefined) {
    const slotsResult = scheduleSchema.safeParse(body.scheduleJson);
    if (!slotsResult.success) {
      res.status(400).json({ error: `Invalid schedule: ${slotsResult.error.message}` });
      return;
    }
  }

  // Path/label sanity.
  if (body.boundAppPath !== undefined && body.boundAppPath.length > 1024) {
    res.status(400).json({ error: "boundAppPath too long" });
    return;
  }
  if (body.boundAppLabel !== undefined && body.boundAppLabel.length > 200) {
    res.status(400).json({ error: "boundAppLabel too long" });
    return;
  }
  if (body.description !== undefined && body.description.length > 4000) {
    res.status(400).json({ error: "description too long (max 4000)" });
    return;
  }

  const [existing] = await db
    .select()
    .from(hostsTable)
    .where(eq(hostsTable.hostToken, params.data.hostToken));
  if (!existing) {
    res.status(404).json({ error: "Host not found" });
    return;
  }

  // Validate gameId references a real catalog entry when provided.
  if (body.gameId) {
    const [game] = await db
      .select({ id: gamesTable.id })
      .from(gamesTable)
      .where(eq(gamesTable.id, body.gameId));
    if (!game) {
      res.status(400).json({ error: "Unknown gameId" });
      return;
    }
  }

  const update: Partial<typeof hostsTable.$inferInsert> = {};
  if (body.gameId !== undefined) update.gameId = body.gameId;
  if (body.boundAppPath !== undefined) update.boundAppPath = body.boundAppPath;
  if (body.boundAppLabel !== undefined) update.boundAppLabel = body.boundAppLabel;
  if (body.description !== undefined) update.description = body.description;
  if (body.launchPriceUsd !== undefined)
    update.launchPriceUsd = String(body.launchPriceUsd);
  if (body.minutePriceUsd !== undefined)
    update.minutePriceUsd = String(body.minutePriceUsd);
  if (body.scheduleMode !== undefined) update.scheduleMode = body.scheduleMode;
  if (body.scheduleJson !== undefined) update.scheduleJson = body.scheduleJson;
  if (body.streamPlatform !== undefined) update.streamPlatform = body.streamPlatform;
  if (body.streamUrl !== undefined) update.streamUrl = body.streamUrl;
  if (body.streamKey !== undefined) {
    update.streamKey = body.streamKey === "" ? "" : encryptSecret(body.streamKey);
  }

  if (Object.keys(update).length === 0) {
    res.json(GetHostResponse.parse(serializeHost(existing)));
    return;
  }

  const [updated] = await db
    .update(hostsTable)
    .set(update)
    .where(eq(hostsTable.id, existing.id))
    .returning();

  if (!updated) {
    res.status(500).json({ error: "Failed to update host" });
    return;
  }

  req.log.info({ hostId: updated.id, fields: Object.keys(update) }, "Host config updated");
  res.json(GetHostResponse.parse(serializeHost(updated)));
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

  // Use the host's configured per-minute price as the historical estimator.
  // Real earnings are tracked in billing_events; this view is just for the
  // dashboard's "lifetime / 7d" headline.
  const RATE_PER_MINUTE = Number(host.minutePriceUsd) || 0.04;
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

    const ratePerMinute = Number(host.minutePriceUsd) || 0.04;
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
          amount: minutes > 0 ? minutes * ratePerMinute : null,
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
