import { Router, type IRouter } from "express";
import { eq, desc, and, sql, isNull as drizzleIsNull } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  hostsTable,
  sessionsTable,
  withdrawalsTable,
  gamesTable,
  scheduleSchema,
  quotasTable,
  quotaSessionsTable,
  loansTable,
  playersTable,
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
import { headerUserToken } from "../lib/requestToken";
import {
  listLibrary,
  addToLibrary,
  updateEntry,
  removeFromLibrary,
} from "../lib/hostLibrary";
import { generalHostTier } from "../lib/hostTier";
import { isQuotaActiveNow } from "../lib/quotaEngine";
import { rateLimit, ipKey } from "../lib/rateLimit";

const router: IRouter = Router();

// Host registration allocates deposit addresses from a finite pool — keep the
// limit conservative and IP-keyed to block pool-exhaustion abuse.
const hostRegisterLimiter = rateLimit({
  scope: "hosts:register",
  windowMs: 60 * 60_000,
  max: 10,
  keyFn: ipKey,
});

// Hosts can declare any rate, including negative ("loss-leader" promos), but
// we cap the absolute value so a typo can't drain a wallet in one tick.
const PRICE_ABS_LIMIT = 100; // USD

function serializeHost(h: typeof hostsTable.$inferSelect) {
  return {
    id: h.id,
    hostToken: h.hostToken,
    displayName: h.displayName,
    internalBalanceLzt: h.internalBalanceLzt,
    withdrawableBalanceLzt: h.withdrawableBalanceLzt,
    gameId: h.gameId,
    boundAppPath: h.boundAppPath,
    boundUrl: h.boundUrl,
    boundAppLabel: h.boundAppLabel,
    description: h.description,
    tags: h.tags ?? [],
    launchPriceUsd: Number(h.launchPriceUsd),
    minutePriceUsd: Number(h.minutePriceUsd),
    scheduleMode: h.scheduleMode,
    scheduleJson: h.scheduleJson ?? [],
    streamPlatform: h.streamPlatform,
    streamUrl: h.streamUrl,
    // Never echo the encrypted key back; surface only whether one is set.
    streamKeySet: (h.streamKey ?? "").length > 0,
    creditMinutesPerNewPlayer: h.creditMinutesPerNewPlayer,
    creditMaxLztPerPlayer: h.creditMaxLztPerPlayer,
    createdAt: h.createdAt,
    lastSeenAt: h.lastSeenAt,
    // Submission outcome notification fields — host dashboard reads these.
    lastSubmissionStatus: h.lastSubmissionStatus ?? null,
    lastSubmissionNote: h.lastSubmissionNote ?? "",
    gamesContributed: h.gamesContributed,
    isAdmin: h.isAdmin === 1,
    // Agent key: expose whether a key is bound, not the key itself.
    agentKeyBound: (h.agentPubkey ?? "").length > 0,
    // PC hardware specs reported by the agent (null until first upload).
    pcSpecs: h.pcSpecs ?? null,
    // Quick general strength badge vs the site-wide baseline (not tied to
    // any specific quota/game): "below_min" | "meets_min" | "above_rec".
    hostTier: generalHostTier(h.pcSpecs),
    // Set when the schedule watchdog auto-deactivated this host's schedule
    // due to a missed wake-up window. Cleared once the hoster saves config.
    scheduleAutoDisabledReason: h.scheduleAutoDisabledReason ?? null,
    scheduleAutoDisabledAt: h.scheduleAutoDisabledAt ?? null,
  };
}

router.post("/hosts/register", hostRegisterLimiter, async (req, res): Promise<void> => {
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
  // Bypass strict Zod parse — serializeHost includes extra fields not yet in the generated schema.
  res.status(201).json(serializeHost(host));
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

  // Bypass strict Zod parse — serializeHost includes extra fields not yet in the generated schema.
  res.json(serializeHost(host));
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
  // Browser-game URL: must be a valid http(s) URL when non-empty.
  let normalizedBoundUrl: string | undefined;
  if (body.boundUrl !== undefined) {
    const trimmed = body.boundUrl.trim();
    if (trimmed.length > 0) {
      let parsed: URL;
      try {
        parsed = new URL(trimmed);
      } catch {
        res.status(400).json({ error: "boundUrl must be a valid http(s) URL" });
        return;
      }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        res.status(400).json({ error: "boundUrl must use http or https" });
        return;
      }
      if (trimmed.length > 2048) {
        res.status(400).json({ error: "boundUrl too long" });
        return;
      }
      normalizedBoundUrl = parsed.toString();
    } else {
      normalizedBoundUrl = "";
    }
  }
  // Tags: ≤20 entries, each ≤40 chars, trimmed and de-duplicated case-insensitively.
  let normalizedTags: string[] | undefined;
  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) {
      res.status(400).json({ error: "tags must be an array of strings" });
      return;
    }
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of body.tags) {
      if (typeof raw !== "string") {
        res.status(400).json({ error: "tags must be an array of strings" });
        return;
      }
      const t = raw.trim();
      if (t.length === 0) continue;
      if (t.length > 40) {
        res.status(400).json({ error: "Each tag must be ≤40 characters" });
        return;
      }
      const key = t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t);
      if (out.length > 20) {
        res.status(400).json({ error: "At most 20 tags are allowed" });
        return;
      }
    }
    normalizedTags = out;
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
  if (normalizedBoundUrl !== undefined) update.boundUrl = normalizedBoundUrl;
  if (body.boundAppLabel !== undefined) update.boundAppLabel = body.boundAppLabel;
  if (body.description !== undefined) update.description = body.description;
  if (normalizedTags !== undefined) update.tags = normalizedTags;
  if (body.launchPriceUsd !== undefined)
    update.launchPriceUsd = String(body.launchPriceUsd);
  if (body.minutePriceUsd !== undefined)
    update.minutePriceUsd = String(body.minutePriceUsd);
  if (body.scheduleMode !== undefined) update.scheduleMode = body.scheduleMode;
  if (body.scheduleJson !== undefined) update.scheduleJson = body.scheduleJson;
  // Any manual config save clears the "auto-disabled" marker — the hoster is
  // actively managing their config again, so the stale warning shouldn't stick.
  if (body.scheduleMode !== undefined || body.scheduleJson !== undefined) {
    update.scheduleAutoDisabledReason = null;
    update.scheduleAutoDisabledAt = null;
  }
  if (body.streamPlatform !== undefined) update.streamPlatform = body.streamPlatform;
  if (body.streamUrl !== undefined) update.streamUrl = body.streamUrl;
  if (body.streamKey !== undefined) {
    update.streamKey = body.streamKey === "" ? "" : encryptSecret(body.streamKey);
  }
  // Host service credit policy.
  if (body.creditMinutesPerNewPlayer !== undefined) {
    const v = Math.floor(body.creditMinutesPerNewPlayer);
    if (!Number.isFinite(v) || v < 0 || v > 1440) {
      res.status(400).json({
        error: "creditMinutesPerNewPlayer must be an integer in [0, 1440]",
      });
      return;
    }
    update.creditMinutesPerNewPlayer = v;
  }
  if (body.creditMaxLztPerPlayer !== undefined) {
    const v = Math.floor(body.creditMaxLztPerPlayer);
    if (!Number.isFinite(v) || v < 0) {
      res
        .status(400)
        .json({ error: "creditMaxLztPerPlayer must be a non-negative integer" });
      return;
    }
    update.creditMaxLztPerPlayer = v;
  }

  if (Object.keys(update).length === 0) {
    res.json(serializeHost(existing));
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
  // Bypass strict Zod parse — serializeHost includes extra fields not yet in the generated schema.
  res.json(serializeHost(updated));
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
      internalBalanceLzt: host.internalBalanceLzt,
      withdrawableBalanceLzt: host.withdrawableBalanceLzt,
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

// ─────────────────────────────────────────────────────────────────────────────
// Host game library endpoints
// ─────────────────────────────────────────────────────────────────────────────

const AddLibraryEntryBody = z.object({
  gameId: z.string().uuid("gameId must be a UUID"),
  pricePerMinuteLzt: z.number().int().min(0).max(200_000),
  appPath: z.string().max(1024).optional(),
  boundUrl: z.string().max(2048).optional(),
  launchArgs: z.string().max(512).optional(),
});

const UpdateLibraryEntryBody = z.object({
  pricePerMinuteLzt: z.number().int().min(0).max(200_000).optional(),
  appPath: z.string().max(1024).optional(),
  boundUrl: z.string().max(2048).optional(),
  launchArgs: z.string().max(512).optional(),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  localAvailable: z.boolean().optional(),
  lastError: z.string().max(512).optional(),
});

const LibraryGameIdParam = z.object({
  hostToken: z.string(),
  gameId: z.string().uuid(),
});

router.get(
  "/hosts/:hostToken/library",
  async (req, res): Promise<void> => {
    const params = GetHostParams.safeParse(req.params);
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
    const entries = await listLibrary(host.id);
    res.json(entries);
  },
);

router.post(
  "/hosts/:hostToken/library",
  async (req, res): Promise<void> => {
    const params = GetHostParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const body = AddLibraryEntryBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
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
    const result = await addToLibrary(host.id, body.data.gameId, {
      pricePerMinuteLzt: body.data.pricePerMinuteLzt,
      appPath: body.data.appPath,
      boundUrl: body.data.boundUrl,
      launchArgs: body.data.launchArgs,
    });
    if (!result.ok) {
      res.status(result.status).json({ error: result.reason });
      return;
    }
    req.log.info(
      { hostId: host.id, gameId: body.data.gameId },
      "Game added to host library",
    );
    res.status(201).json(result.entry);
  },
);

router.patch(
  "/hosts/:hostToken/library/:gameId",
  async (req, res): Promise<void> => {
    const params = LibraryGameIdParam.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const body = UpdateLibraryEntryBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
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
    const result = await updateEntry(host.id, params.data.gameId, body.data);
    if (!result.ok) {
      res.status(result.status).json({ error: result.reason });
      return;
    }
    req.log.info(
      { hostId: host.id, gameId: params.data.gameId },
      "Host library entry updated",
    );
    res.json(result.entry);
  },
);

router.delete(
  "/hosts/:hostToken/library/:gameId",
  async (req, res): Promise<void> => {
    const params = LibraryGameIdParam.safeParse(req.params);
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
    const result = await removeFromLibrary(host.id, params.data.gameId);
    if (!result.ok) {
      res.status(result.status).json({ error: result.reason });
      return;
    }
    req.log.info(
      { hostId: host.id, gameId: params.data.gameId },
      "Game removed from host library",
    );
    res.status(204).send();
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Quota attach / detach — agent-driven auto-quota management
// ─────────────────────────────────────────────────────────────────────────────

const AttachQuotaBody = z.object({
  hostToken: z.string(),
  quotaId: z.string().uuid(),
});

const DetachQuotaBody = z.object({
  hostToken: z.string(),
});

// GET /api/hosts/me/current-quota — returns the quota attached to the
// host's current active/pending session, or null.
router.get("/hosts/me/current-quota", async (req, res): Promise<void> => {
  const hostToken = headerUserToken(req) ?? String(req.query.hostToken ?? "");
  if (!hostToken) {
    res.status(400).json({ error: "hostToken required" });
    return;
  }
  const [host] = await db
    .select({ id: hostsTable.id })
    .from(hostsTable)
    .where(eq(hostsTable.hostToken, hostToken));
  if (!host) {
    res.status(404).json({ error: "Host not found" });
    return;
  }

  const [session] = await db
    .select({ id: sessionsTable.id, quotaId: sessionsTable.quotaId })
    .from(sessionsTable)
    .where(
      and(
        eq(sessionsTable.hostId, host.id),
        sql`${sessionsTable.status} in ('pending','active')`,
      ),
    )
    .orderBy(desc(sessionsTable.createdAt))
    .limit(1);

  if (!session || !session.quotaId) {
    res.json({ quota: null });
    return;
  }

  const [quota] = await db
    .select()
    .from(quotasTable)
    .where(eq(quotasTable.id, session.quotaId));

  res.json({ quota: quota ?? null, sessionId: session.id });
});

// POST /api/hosts/me/attach-quota — attach a quota to the host's current
// active session. Returns 409 when the session already has a different quota.
router.post("/hosts/me/attach-quota", async (req, res): Promise<void> => {
  const parsed = AttachQuotaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { hostToken, quotaId } = parsed.data;

  const [host] = await db
    .select({ id: hostsTable.id })
    .from(hostsTable)
    .where(eq(hostsTable.hostToken, hostToken));
  if (!host) {
    res.status(404).json({ error: "Host not found" });
    return;
  }

  const [quota] = await db
    .select()
    .from(quotasTable)
    .where(eq(quotasTable.id, quotaId));
  if (!quota) {
    res.status(404).json({ error: "Quota not found" });
    return;
  }
  if (!isQuotaActiveNow(quota)) {
    res.status(400).json({ error: `Quota is not active (status: ${quota.status})` });
    return;
  }

  // Find the host's most-recent non-ended session.
  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(
      and(
        eq(sessionsTable.hostId, host.id),
        // status IN ('pending','active') — use sql expression
        sql`${sessionsTable.status} in ('pending','active')`,
      ),
    )
    .orderBy(desc(sessionsTable.createdAt))
    .limit(1);

  if (!session) {
    res.status(404).json({ error: "No active session found for this host" });
    return;
  }

  if (session.quotaId === quotaId) {
    // Idempotent re-confirmation — allowed even for key-exclusive quotas,
    // since this session was already auto-attached (e.g. via /embed/sessions).
    res.json({ ok: true, sessionId: session.id, quotaId });
    return;
  }

  if (quota.devKeyId) {
    res.status(403).json({
      error: "quota_key_exclusive",
      message:
        "This quota is exclusive to a specific API key and can only be used by sessions launched through that key.",
    });
    return;
  }

  if (session.quotaId && session.quotaId !== quotaId) {
    res.status(409).json({ error: "Session already has a different quota attached" });
    return;
  }

  // Transactional attach: update session + upsert quota_sessions atomically
  // to prevent races where two agents try to attach the same quota to
  // different sessions simultaneously.
  await db.transaction(async (tx) => {
    await tx
      .update(sessionsTable)
      .set({ quotaId })
      .where(eq(sessionsTable.id, session.id));

    // Create quota_sessions tracking row if it doesn't exist.
    const [existing] = await tx
      .select({ id: quotaSessionsTable.id })
      .from(quotaSessionsTable)
      .where(
        and(
          eq(quotaSessionsTable.quotaId, quotaId),
          eq(quotaSessionsTable.sessionId, session.id),
        ),
      );
    if (!existing) {
      await tx.insert(quotaSessionsTable).values({
        quotaId,
        sessionId: session.id,
      });
    }
  });

  req.log.info({ hostId: host.id, sessionId: session.id, quotaId }, "Quota attached to session");
  res.json({ ok: true, sessionId: session.id, quotaId });
});

// POST /api/hosts/me/detach-quota — detach the current quota from the
// host's active session.
router.post("/hosts/me/detach-quota", async (req, res): Promise<void> => {
  const parsed = DetachQuotaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { hostToken } = parsed.data;

  const [host] = await db
    .select({ id: hostsTable.id })
    .from(hostsTable)
    .where(eq(hostsTable.hostToken, hostToken));
  if (!host) {
    res.status(404).json({ error: "Host not found" });
    return;
  }

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(
      and(
        eq(sessionsTable.hostId, host.id),
        sql`${sessionsTable.status} in ('pending','active')`,
      ),
    )
    .orderBy(desc(sessionsTable.createdAt))
    .limit(1);

  if (!session || !session.quotaId) {
    res.json({ ok: true, message: "No quota was attached" });
    return;
  }

  const detachedQuotaId = session.quotaId;

  await db
    .update(sessionsTable)
    .set({ quotaId: null })
    .where(eq(sessionsTable.id, session.id));

  // Mark quota_sessions row as detached.
  await db
    .update(quotaSessionsTable)
    .set({ detachedAt: new Date() })
    .where(
      and(
        eq(quotaSessionsTable.quotaId, detachedQuotaId),
        eq(quotaSessionsTable.sessionId, session.id),
        drizzleIsNull(quotaSessionsTable.detachedAt),
      ),
    );

  req.log.info({ hostId: host.id, sessionId: session.id, detachedQuotaId }, "Quota detached from session");
  res.json({ ok: true, sessionId: session.id });
});

// ─────────────────────────────────────────────────────────────────────────────
// PC-specs endpoint — agent reports hardware details
// ─────────────────────────────────────────────────────────────────────────────

const PcSpecsBody = z.object({
  gpu: z.string().max(256),
  cpu: z.string().max(256),
  ramGb: z.number().int().min(0).max(65536),
});

router.post("/hosts/me/pc-specs", async (req, res): Promise<void> => {
  // Auth by hostToken supplied in the Authorization header or the body.
  // Prefer the header (Bearer <token>) for cleanliness; fall back to body field
  // so the agent can use a simple JSON POST without extra headers.
  let hostToken: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    hostToken = authHeader.slice(7).trim();
  } else if (typeof req.body?.hostToken === "string") {
    hostToken = (req.body as { hostToken: string }).hostToken.trim();
  }

  if (!hostToken) {
    res.status(401).json({ error: "Missing hostToken" });
    return;
  }

  const body = PcSpecsBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [host] = await db
    .select({ id: hostsTable.id, pcSpecs: hostsTable.pcSpecs })
    .from(hostsTable)
    .where(eq(hostsTable.hostToken, hostToken));
  if (!host) {
    res.status(404).json({ error: "Host not found" });
    return;
  }

  // Merge with existing pcSpecs so measured values (e.g. uploadMbps) are preserved.
  const existing = (host.pcSpecs ?? {}) as Record<string, unknown>;
  const pcSpecs = {
    ...existing,
    gpu: body.data.gpu,
    cpu: body.data.cpu,
    ramGb: body.data.ramGb,
  };

  await db
    .update(hostsTable)
    .set({ pcSpecs })
    .where(eq(hostsTable.id, host.id));

  req.log.info({ hostId: host.id }, "PC specs updated");
  res.json({ ok: true, pcSpecs });
});

// ---- Upload speed test ----
// The host agent POSTs ~1 MB of random binary data; the server measures the
// elapsed time and persists the result in pcSpecs.uploadMbps.
router.post("/hosts/me/speedtest", async (req, res): Promise<void> => {
  const hostToken =
    (req.headers["x-host-token"] as string | undefined) ??
    (req.headers["x-token"] as string | undefined);
  if (!hostToken) {
    res.status(400).json({ error: "X-Host-Token header required" });
    return;
  }
  const [host] = await db
    .select()
    .from(hostsTable)
    .where(eq(hostsTable.hostToken, hostToken));
  if (!host) {
    res.status(404).json({ error: "Host not found" });
    return;
  }

  // Collect raw bytes and measure elapsed time.
  const started = Date.now();
  await new Promise<void>((resolve) => {
    req.resume();
    req.on("end", resolve);
    req.on("error", resolve);
  });
  const elapsedMs = Date.now() - started;
  const bytes = Number(req.headers["content-length"] ?? 0);

  let uploadMbps: number | null = null;
  if (bytes > 0 && elapsedMs > 0) {
    uploadMbps = Math.round((bytes * 8) / elapsedMs / 1000); // bits/ms = Mbps
  }

  if (uploadMbps !== null && uploadMbps > 0) {
    const existing = (host.pcSpecs ?? {}) as Record<string, unknown>;
    await db
      .update(hostsTable)
      .set({ pcSpecs: { ...existing, uploadMbps } as typeof host.pcSpecs })
      .where(eq(hostsTable.id, host.id));
  }

  res.json({ ok: true, uploadMbps });
});

// GET /hosts/me/speedtest/download — agent measures download throughput.
router.get("/hosts/me/speedtest/download", async (req, res): Promise<void> => {
  const hostToken =
    (req.headers["x-host-token"] as string | undefined) ??
    (req.headers["x-token"] as string | undefined);
  if (!hostToken) {
    res.status(400).json({ error: "X-Host-Token header required" });
    return;
  }
  const [host] = await db
    .select()
    .from(hostsTable)
    .where(eq(hostsTable.hostToken, hostToken));
  if (!host) {
    res.status(404).json({ error: "Host not found" });
    return;
  }

  const bytesParam = Number(req.query.bytes ?? 512 * 1024);
  const bytes = Number.isFinite(bytesParam)
    ? Math.min(Math.max(bytesParam, 64 * 1024), 2 * 1024 * 1024)
    : 512 * 1024;

  const started = Date.now();
  const payload = Buffer.alloc(bytes, 0x5a);
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Length", String(bytes));
  res.send(payload);

  const elapsedMs = Date.now() - started;
  const downloadMbps =
    elapsedMs > 0 ? Math.round((bytes * 8) / elapsedMs / 1000) : null;
  if (downloadMbps !== null && downloadMbps > 0) {
    const existing = (host.pcSpecs ?? {}) as Record<string, unknown>;
    void db
      .update(hostsTable)
      .set({ pcSpecs: { ...existing, downloadMbps } as typeof host.pcSpecs })
      .where(eq(hostsTable.id, host.id));
  }
});

// List players who have an open host_service debt to this host.
// Returns each debtor with their current outstanding amount and
// how much has already been streamed back.
router.get("/hosts/:hostToken/debtors", async (req, res): Promise<void> => {
  const hostToken = req.params.hostToken;
  if (!hostToken) {
    res.status(400).json({ error: "hostToken required" });
    return;
  }
  const [host] = await db
    .select({ id: hostsTable.id })
    .from(hostsTable)
    .where(eq(hostsTable.hostToken, hostToken));
  if (!host) {
    res.status(404).json({ error: "Host not found" });
    return;
  }

  const loans = await db
    .select({
      loanId: loansTable.id,
      borrowerId: loansTable.borrowerId,
      principalLzt: loansTable.principalLzt,
      outstandingLzt: loansTable.outstandingLzt,
      repaidLzt: loansTable.repaidLzt,
      status: loansTable.status,
      startedAt: loansTable.startedAt,
      dueAt: loansTable.dueAt,
      // Player display info
      playerDisplayName: playersTable.displayName,
    })
    .from(loansTable)
    .leftJoin(playersTable, eq(playersTable.id, loansTable.borrowerId))
    .where(
      and(
        eq(loansTable.loanType, "host_service"),
        eq(loansTable.lenderType, "host"),
        eq(loansTable.lenderId, host.id),
        sql`${loansTable.status} in ('active', 'defaulted')`,
      ),
    )
    .orderBy(desc(loansTable.startedAt));

  res.json({
    debtors: loans.map((l) => ({
      loanId: l.loanId,
      playerId: l.borrowerId,
      playerDisplayName: l.playerDisplayName ?? null,
      principalLzt: l.principalLzt,
      outstandingLzt: l.outstandingLzt,
      repaidLzt: l.repaidLzt,
      status: l.status,
      startedAt: l.startedAt,
      dueAt: l.dueAt,
    })),
    totalOutstandingLzt: loans.reduce((s, l) => s + l.outstandingLzt, 0),
  });
});

router.post("/hosts/heartbeat", async (req, res): Promise<void> => {
  const hostToken =
    (req.headers["x-host-token"] as string | undefined) ||
    (req.body as { hostToken?: string }).hostToken;
  if (!hostToken) {
    res.status(401).json({ error: "hostToken required" });
    return;
  }
  const [host] = await db
    .select({ id: hostsTable.id })
    .from(hostsTable)
    .where(eq(hostsTable.hostToken, hostToken));
  if (!host) {
    res.status(404).json({ error: "Host not found" });
    return;
  }

  const body = req.body as { hostToken?: string; pingMs?: number };
  const update: Partial<typeof hostsTable.$inferInsert> = { lastSeenAt: new Date() };
  if (typeof body.pingMs === "number" && Number.isFinite(body.pingMs) && body.pingMs >= 0) {
    update.pingMs = Math.round(body.pingMs);
  }

  await db
    .update(hostsTable)
    .set(update)
    .where(eq(hostsTable.id, host.id));
  const { emitPlatformEvent } = await import("../lib/pgNotify");
  void emitPlatformEvent("host_last_seen", { hostId: host.id });
  res.json({ ok: true });
});

export default router;
