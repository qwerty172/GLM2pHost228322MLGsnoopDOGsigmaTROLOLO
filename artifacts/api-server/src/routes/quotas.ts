import { Router, type IRouter } from "express";
import { and, desc, eq, isNull, sql, inArray, or } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  gamesTable,
  hostsTable,
  playersTable,
  quotasTable,
  quotaSessionsTable,
  billingEventsTable,
  sessionsTable,
  devKeysTable,
  type Quota,
} from "@workspace/db";
import { CreateQuotaBody, UpdateQuotaBody, AiSuggestQuotaSpecsBody } from "@workspace/api-zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";

// Orval splits each endpoint's body into a unique generated symbol; we use a
// single local schema for the simple owner-only POST bodies.
const QuotaOwnerBody = z.object({ ownerToken: z.string() });
import { resolveOwnerByToken } from "../lib/walletOwner";
import {
  generateAccessCode,
  creditOwnerGreen,
  isQuotaActiveNow,
} from "../lib/quotaEngine";
import { computeHostTier, specsFromPcSpecs } from "../lib/hostTier";

const router: IRouter = Router();

// Postgres unique-violation error code, used to detect a race on the
// partial unique index over quotas.devKeyId.
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

// Never expose the raw key back to the client — only whether one is linked
// and a masked hint, similar to how access codes are hidden from non-owners.
function maskApiKey(key: string): string {
  if (key.length <= 8) return "••••";
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

function shapeQuota(
  q: Quota,
  opts: {
    includeAccessCode: boolean;
    ownerDisplayName: string;
    gameTitle: string | null;
    apiKeyMasked?: string | null;
  },
) {
  return {
    id: q.id,
    ownerType: q.ownerType as "host" | "player",
    ownerId: q.ownerId,
    ownerDisplayName: opts.ownerDisplayName,
    hasApiKey: !!q.devKeyId,
    apiKeyMasked: opts.apiKeyMasked ?? null,
    kind: q.kind as "royalty" | "sponsor",
    status: q.status as
      | "draft"
      | "active"
      | "paused"
      | "exhausted"
      | "expired"
      | "closed",
    title: q.title,
    description: q.description,
    gameId: q.gameId,
    gameTitle: opts.gameTitle,
    visibility: q.visibility as "public" | "private",
    accessCode: opts.includeAccessCode ? q.accessCode : null,
    minSessionMinutes: q.minSessionMinutes,
    maxSessionMinutes: q.maxSessionMinutes,
    startAt: q.startAt.toISOString(),
    endAt: q.endAt ? q.endAt.toISOString() : null,
    budgetLzt: q.budgetLzt,
    escrowRemainingLzt: q.escrowRemainingLzt,
    sponsorHostPerMinuteLzt: q.sponsorHostPerMinuteLzt,
    sponsorPlayerPerMinuteLzt: q.sponsorPlayerPerMinuteLzt,
    royaltyBasis: q.royaltyBasis,
    royaltyValue: q.royaltyValue,
    royaltySource: q.royaltySource,
    minGpuVram: q.minGpuVram,
    minCpuCores: q.minCpuCores,
    minRamGb: q.minRamGb,
    minDownloadMbps: q.minDownloadMbps,
    minUploadMbps: q.minUploadMbps,
    recGpuVram: q.recGpuVram,
    recCpuCores: q.recCpuCores,
    recRamGb: q.recRamGb,
    recDownloadMbps: q.recDownloadMbps,
    recUploadMbps: q.recUploadMbps,
    requiredTier: q.requiredTier as "min" | "recommended",
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
  };
}

async function decorate(
  quotas: Quota[],
  opts: { includeAccessCodeForOwnerId?: string | null },
) {
  const ownerHostIds = Array.from(
    new Set(quotas.filter((q) => q.ownerType === "host").map((q) => q.ownerId)),
  );
  const ownerPlayerIds = Array.from(
    new Set(
      quotas.filter((q) => q.ownerType === "player").map((q) => q.ownerId),
    ),
  );
  const gameIds = Array.from(
    new Set(quotas.map((q) => q.gameId).filter((x): x is string => !!x)),
  );
  const devKeyIds = Array.from(
    new Set(quotas.map((q) => q.devKeyId).filter((x): x is string => !!x)),
  );

  const hostRows = ownerHostIds.length
    ? await db
        .select({ id: hostsTable.id, displayName: hostsTable.displayName })
        .from(hostsTable)
        .where(inArray(hostsTable.id, ownerHostIds))
    : [];
  const playerRows = ownerPlayerIds.length
    ? await db
        .select({
          id: playersTable.id,
          displayName: playersTable.displayName,
        })
        .from(playersTable)
        .where(inArray(playersTable.id, ownerPlayerIds))
    : [];
  const gameRows = gameIds.length
    ? await db
        .select({ id: gamesTable.id, title: gamesTable.title })
        .from(gamesTable)
        .where(inArray(gamesTable.id, gameIds))
    : [];
  const devKeyRows = devKeyIds.length
    ? await db
        .select({ id: devKeysTable.id, apiKey: devKeysTable.apiKey })
        .from(devKeysTable)
        .where(inArray(devKeysTable.id, devKeyIds))
    : [];

  const hostName = new Map(hostRows.map((r) => [r.id, r.displayName]));
  const playerName = new Map(playerRows.map((r) => [r.id, r.displayName]));
  const gameTitle = new Map(gameRows.map((r) => [r.id, r.title]));
  const devKeyMasked = new Map(
    devKeyRows.map((r) => [r.id, maskApiKey(r.apiKey)]),
  );

  return quotas.map((q) =>
    shapeQuota(q, {
      includeAccessCode:
        !!opts.includeAccessCodeForOwnerId &&
        opts.includeAccessCodeForOwnerId === q.ownerId,
      apiKeyMasked: q.devKeyId ? devKeyMasked.get(q.devKeyId) ?? null : null,
      ownerDisplayName:
        q.ownerType === "host"
          ? hostName.get(q.ownerId) ?? "Хост"
          : playerName.get(q.ownerId) ?? "Игрок",
      gameTitle: q.gameId ? gameTitle.get(q.gameId) ?? null : null,
    }),
  );
}

// ---------- Validation helpers ----------

function validateRoyaltyConfig(q: {
  royaltyBasis: string | null;
  royaltyValue: number | null;
  royaltySource: string | null;
}): string | null {
  if (
    q.royaltyBasis !== "percent" &&
    q.royaltyBasis !== "fixed_per_minute"
  ) {
    return "royaltyBasis must be percent or fixed_per_minute";
  }
  if (q.royaltyValue == null || q.royaltyValue < 0) {
    return "royaltyValue must be a non-negative integer";
  }
  if (q.royaltyBasis === "percent" && q.royaltyValue > 100) {
    return "royalty percent must be between 0 and 100";
  }
  if (q.royaltySource !== "player" && q.royaltySource !== "host_share") {
    return "royaltySource must be player or host_share";
  }
  return null;
}

function validateSponsorConfig(q: {
  budgetLzt: number | null;
  sponsorHostPerMinuteLzt: number | null;
  sponsorPlayerPerMinuteLzt: number | null;
}): string | null {
  if (q.budgetLzt == null || q.budgetLzt <= 0) {
    return "budgetLzt must be a positive integer";
  }
  const hostAdd = q.sponsorHostPerMinuteLzt ?? 0;
  const playerAdd = q.sponsorPlayerPerMinuteLzt ?? 0;
  if (hostAdd < 0 || playerAdd < 0) {
    return "sponsor per-minute amounts must be non-negative";
  }
  if (hostAdd === 0 && playerAdd === 0) {
    return "sponsor quota must pay at least the host or the player per minute";
  }
  return null;
}

// ---------- AI suggest PC specs ----------

router.post("/quotas/ai-suggest-specs", async (req, res): Promise<void> => {
  const parsed = AiSuggestQuotaSpecsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { gameId } = parsed.data;
  let resolvedTitle = parsed.data.gameTitle ?? null;
  let resolvedGenre = parsed.data.genre ?? null;

  // Resolve game title and genre from gameId when provided
  if (gameId) {
    const [game] = await db
      .select({ title: gamesTable.title, genre: gamesTable.genre })
      .from(gamesTable)
      .where(eq(gamesTable.id, gameId));
    if (game) {
      if (!resolvedTitle) resolvedTitle = game.title;
      if (!resolvedGenre && game.genre) resolvedGenre = game.genre;
    }
  }

  let prompt: string;
  if (resolvedTitle) {
    prompt = `Какие минимальные и рекомендуемые требования к ПК для комфортного стриминга игры ${resolvedTitle}${resolvedGenre ? ` (жанр: ${resolvedGenre})` : ""} в 1080p60? Ответь ТОЛЬКО JSON объектом без комментариев и markdown, вот пример формата: {"minGpuVram": 6, "minCpuCores": 6, "minRamGb": 16, "minDownloadMbps": 50, "minUploadMbps": 10, "recGpuVram": 10, "recCpuCores": 8, "recRamGb": 32, "recDownloadMbps": 100, "recUploadMbps": 20}. Поля min* — минимальные требования, rec* — рекомендуемые (должны быть строго выше min*). *GpuVram — видеопамять GPU в ГБ, *CpuCores — количество ядер CPU, *RamGb — ОЗУ в ГБ, *DownloadMbps — скорость скачивания в Мбит/с, *UploadMbps — скорость аплоада в Мбит/с (критично для стрима!).`;
  } else {
    prompt = `Верни универсальные минимальные и рекомендуемые требования к ПК для стриминга игр в 1080p60. Ответь ТОЛЬКО JSON объектом без комментариев и markdown, вот пример формата: {"minGpuVram": 6, "minCpuCores": 4, "minRamGb": 16, "minDownloadMbps": 50, "minUploadMbps": 10, "recGpuVram": 10, "recCpuCores": 8, "recRamGb": 32, "recDownloadMbps": 100, "recUploadMbps": 20}.`;
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    });
    const text = message.content.find((b) => b.type === "text")?.text ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      res.status(500).json({ error: "AI returned unexpected format" });
      return;
    }
    const data = JSON.parse(jsonMatch[0]) as {
      minGpuVram?: unknown;
      minCpuCores?: unknown;
      minRamGb?: unknown;
      minDownloadMbps?: unknown;
      minUploadMbps?: unknown;
      recGpuVram?: unknown;
      recCpuCores?: unknown;
      recRamGb?: unknown;
      recDownloadMbps?: unknown;
      recUploadMbps?: unknown;
    };
    const minGpuVram = typeof data.minGpuVram === "number" ? Math.round(data.minGpuVram) : 6;
    const minCpuCores = typeof data.minCpuCores === "number" ? Math.round(data.minCpuCores) : 4;
    const minRamGb = typeof data.minRamGb === "number" ? Math.round(data.minRamGb) : 16;
    const minDownloadMbps = typeof data.minDownloadMbps === "number" ? Math.round(data.minDownloadMbps) : 50;
    const minUploadMbps = typeof data.minUploadMbps === "number" ? Math.round(data.minUploadMbps) : 10;
    res.json({
      minGpuVram,
      minCpuCores,
      minRamGb,
      minDownloadMbps,
      minUploadMbps,
      // rec* must always be >= min* even if the AI returns something odd.
      recGpuVram: Math.max(minGpuVram, typeof data.recGpuVram === "number" ? Math.round(data.recGpuVram) : minGpuVram * 2),
      recCpuCores: Math.max(minCpuCores, typeof data.recCpuCores === "number" ? Math.round(data.recCpuCores) : minCpuCores * 2),
      recRamGb: Math.max(minRamGb, typeof data.recRamGb === "number" ? Math.round(data.recRamGb) : minRamGb * 2),
      recDownloadMbps: Math.max(minDownloadMbps, typeof data.recDownloadMbps === "number" ? Math.round(data.recDownloadMbps) : minDownloadMbps * 2),
      recUploadMbps: Math.max(minUploadMbps, typeof data.recUploadMbps === "number" ? Math.round(data.recUploadMbps) : minUploadMbps * 2),
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "AI request failed",
    });
  }
});

// ---------- Public list ----------

const ListPublicQuery = z.object({
  kind: z.enum(["royalty", "sponsor"]).optional(),
  gameId: z.string().optional(),
});

router.get("/quotas", async (req, res): Promise<void> => {
  const parsed = ListPublicQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const conds = [
    eq(quotasTable.visibility, "public"),
    inArray(quotasTable.status, ["active", "paused", "exhausted"]),
  ];
  if (parsed.data.kind) conds.push(eq(quotasTable.kind, parsed.data.kind));
  if (parsed.data.gameId)
    conds.push(eq(quotasTable.gameId, parsed.data.gameId));
  const rows = await db
    .select()
    .from(quotasTable)
    .where(and(...conds))
    .orderBy(desc(quotasTable.createdAt))
    .limit(200);
  res.json(await decorate(rows, {}));
});

// ---------- Mine ----------

router.get("/quotas/mine", async (req, res): Promise<void> => {
  const token = String(req.query.ownerToken ?? "");
  if (!token) {
    res.status(400).json({ error: "ownerToken required" });
    return;
  }
  const owner = await resolveOwnerByToken(token);
  if (!owner) {
    res.status(404).json({ error: "Owner not found" });
    return;
  }
  const rows = await db
    .select()
    .from(quotasTable)
    .where(
      and(
        eq(quotasTable.ownerType, owner.type),
        eq(quotasTable.ownerId, owner.id),
      ),
    )
    .orderBy(desc(quotasTable.createdAt));
  res.json(
    await decorate(rows, { includeAccessCodeForOwnerId: owner.id }),
  );
});

// ---------- Applied to the caller as host or player ----------
//
// Returns quotas that have been attached to at least one session where the
// caller participated (as host OR as the player who claimed it). Used by the
// quotas list page so users can see contracts they've benefited from / played
// under, not just ones they own.
router.get("/quotas/applied", async (req, res): Promise<void> => {
  const token = String(req.query.ownerToken ?? "");
  if (!token) {
    res.status(400).json({ error: "ownerToken required" });
    return;
  }
  const owner = await resolveOwnerByToken(token);
  if (!owner) {
    res.status(404).json({ error: "Owner not found" });
    return;
  }
  const sessionCond =
    owner.type === "host"
      ? eq(sessionsTable.hostId, owner.id)
      : eq(sessionsTable.claimedByPlayerId, owner.id);
  const rows = await db
    .selectDistinct({ q: quotasTable })
    .from(quotaSessionsTable)
    .innerJoin(quotasTable, eq(quotasTable.id, quotaSessionsTable.quotaId))
    .innerJoin(sessionsTable, eq(sessionsTable.id, quotaSessionsTable.sessionId))
    .where(
      and(
        sessionCond,
        // Hide quotas the caller owns — they show up under "Мои" already.
        sql`not (${quotasTable.ownerType} = ${owner.type} and ${quotasTable.ownerId} = ${owner.id})`,
      ),
    )
    .orderBy(desc(quotasTable.createdAt))
    .limit(200);
  res.json(await decorate(rows.map((r) => r.q), {}));
});

// ---------- Match quotas to host PC specs ----------
//
// Returns active public quotas that are compatible with the host's PC
// hardware (pcSpecs ≥ minSpecs — currently sorted by profitability only,
// hardware filtering will be added once minSpecs columns land on quotas).
// Sponsor quotas with a higher remaining escrow come first; royalty quotas
// follow sorted by royaltyValue descending.

router.get("/quotas/match-my-host", async (req, res): Promise<void> => {
  const hostToken = String(req.query.hostToken ?? "");
  if (!hostToken) {
    res.status(400).json({ error: "hostToken required" });
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

  const now = new Date();
  const rows = await db
    .select()
    .from(quotasTable)
    .where(
      and(
        eq(quotasTable.visibility, "public"),
        eq(quotasTable.status, "active"),
      ),
    )
    .orderBy(desc(quotasTable.createdAt))
    .limit(200);

  // Filter to currently-active quotas only.
  const active = rows.filter((q) => isQuotaActiveNow(q, now));

  // Hardware compatibility: hard-floor filter using the quota's min* fields
  // (plus streaming overhead), and — when the quota requires the stricter
  // "recommended" tier — its rec* fields too. If the host has no pcSpecs yet
  // (null), we still return quotas with no requirement so the host can start
  // working immediately.
  const hostSpecs = specsFromPcSpecs(host.pcSpecs);
  const filtered = active.filter((q) => {
    const tier = computeHostTier(
      hostSpecs,
      {
        gpuVram: q.minGpuVram,
        cpuCores: q.minCpuCores,
        ramGb: q.minRamGb,
        downloadMbps: q.minDownloadMbps,
        uploadMbps: q.minUploadMbps,
      },
      {
        gpuVram: q.recGpuVram,
        cpuCores: q.recCpuCores,
        ramGb: q.recRamGb,
        downloadMbps: q.recDownloadMbps,
        uploadMbps: q.recUploadMbps,
      },
    );
    if (tier === "below_min") return false;
    if (q.requiredTier === "recommended" && tier !== "above_rec") return false;
    return true;
  });

  // Sort by profitability: sponsor quotas with higher escrow first, then
  // royalty quotas sorted by royaltyValue descending.
  filtered.sort((a, b) => {
    if (a.kind === "sponsor" && b.kind === "sponsor") {
      return (b.escrowRemainingLzt ?? 0) - (a.escrowRemainingLzt ?? 0);
    }
    if (a.kind === "sponsor") return -1;
    if (b.kind === "sponsor") return 1;
    return (b.royaltyValue ?? 0) - (a.royaltyValue ?? 0);
  });

  res.json(await decorate(filtered.slice(0, 20), {}));
});

// ---------- Applicable to a host's next session ----------

router.get("/quotas/applicable", async (req, res): Promise<void> => {
  const hostToken = String(req.query.hostToken ?? "");
  const gameId = req.query.gameId ? String(req.query.gameId) : null;
  const accessCode = req.query.accessCode
    ? String(req.query.accessCode).trim()
    : "";
  if (!hostToken) {
    res.status(400).json({ error: "hostToken required" });
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
  const effectiveGameId = gameId ?? host.gameId ?? null;

  // Game match: gameId column NULL (any-game) OR equals the host's game.
  const gameMatch = effectiveGameId
    ? or(
        isNull(quotasTable.gameId),
        eq(quotasTable.gameId, effectiveGameId),
      )
    : isNull(quotasTable.gameId);

  // Owner's own quotas still need to satisfy game binding — picker output
  // must match what /sessions will accept.
  const ownClause = and(
    eq(quotasTable.ownerType, "host"),
    eq(quotasTable.ownerId, host.id),
    gameMatch,
  );
  const publicClause = and(
    eq(quotasTable.visibility, "public"),
    eq(quotasTable.status, "active"),
    gameMatch,
  );
  const conds: ReturnType<typeof or>[] = [or(ownClause, publicClause)];
  if (accessCode) {
    conds.push(
      and(
        eq(quotasTable.visibility, "private"),
        eq(quotasTable.status, "active"),
        eq(quotasTable.accessCode, accessCode),
        gameMatch,
      ),
    );
  }
  const rows = await db
    .select()
    .from(quotasTable)
    .where(or(...conds))
    .orderBy(desc(quotasTable.createdAt))
    .limit(100);

  // Enforce full applicability — picker must never surface a quota that the
  // /sessions endpoint will reject (status not active, outside start/end
  // window, sponsor escrow exhausted, …).
  const now = new Date();
  const filtered = rows.filter((q) => isQuotaActiveNow(q, now));
  res.json(
    await decorate(filtered, { includeAccessCodeForOwnerId: host.id }),
  );
});

// ---------- Detail ----------

router.get("/quotas/:id", async (req, res): Promise<void> => {
  const id = req.params.id ?? "";
  const ownerToken = req.query.ownerToken
    ? String(req.query.ownerToken)
    : null;
  const [quota] = await db
    .select()
    .from(quotasTable)
    .where(eq(quotasTable.id, id));
  if (!quota) {
    res.status(404).json({ error: "Quota not found" });
    return;
  }
  let isOwner = false;
  if (ownerToken) {
    const owner = await resolveOwnerByToken(ownerToken);
    if (owner && owner.id === quota.ownerId && owner.type === quota.ownerType) {
      isOwner = true;
    }
  }

  // Stats: active/closed session counts + total paid out + recent movements.
  const linkCounts = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${quotaSessionsTable.detachedAt} is null)::int`,
    })
    .from(quotaSessionsTable)
    .where(eq(quotaSessionsTable.quotaId, quota.id));
  const totalSessions = Number(linkCounts[0]?.total ?? 0);
  const activeSessions = Number(linkCounts[0]?.active ?? 0);

  const movementsRows = await db
    .select()
    .from(billingEventsTable)
    .where(eq(billingEventsTable.quotaId, quota.id))
    .orderBy(desc(billingEventsTable.billedAt))
    .limit(50);
  const movements = movementsRows.map((m) => ({
    id: m.id,
    sessionId: m.sessionId,
    kind: m.kind,
    amountLzt:
      m.kind === "quota_escrow_refund" || m.kind === "quota_escrow_lock"
        ? Math.abs(m.playerDebitLzt) || Math.abs(m.hostCreditLzt) || 0
        : 0,
    billedAt: m.billedAt.toISOString(),
  }));
  // Compute total paid-out from quota_sessions totals (cheaper than re-summing
  // events row-by-row).
  const totalsRow = await db
    .select({
      r: sql<number>`coalesce(sum(${quotaSessionsTable.totalRoyaltyLzt}), 0)::int`,
      sh: sql<number>`coalesce(sum(${quotaSessionsTable.totalSponsorHostLzt}), 0)::int`,
      sp: sql<number>`coalesce(sum(${quotaSessionsTable.totalSponsorPlayerLzt}), 0)::int`,
    })
    .from(quotaSessionsTable)
    .where(eq(quotaSessionsTable.quotaId, quota.id));
  const totals = totalsRow[0] ?? { r: 0, sh: 0, sp: 0 };
  const totalPaidOutLzt =
    Number(totals.r) + Number(totals.sh) + Number(totals.sp);

  // Fill `amountLzt` for each movement from the corresponding running total or
  // billing-event value.
  const annotatedMovements = movementsRows.map((m) => {
    let amt = 0;
    if (m.kind === "quota_escrow_lock") amt = Math.abs(m.hostCreditLzt);
    else if (m.kind === "quota_escrow_refund") amt = Math.abs(m.hostCreditLzt);
    else amt = m.hostCreditLzt || m.playerDebitLzt;
    return {
      id: m.id,
      sessionId: m.sessionId,
      kind: m.kind,
      amountLzt: amt,
      billedAt: m.billedAt.toISOString(),
    };
  });
  void movements; // keep linter happy

  const [decorated] = await decorate([quota], {
    includeAccessCodeForOwnerId: isOwner ? quota.ownerId : null,
  });

  res.json({
    ...decorated,
    activeSessionCount: activeSessions,
    closedSessionCount: totalSessions - activeSessions,
    totalPaidOutLzt,
    recentMovements: annotatedMovements,
    isOwner,
  });
});

// ---------- Create ----------

router.post("/quotas", async (req, res): Promise<void> => {
  const parsed = CreateQuotaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const body = parsed.data;
  const owner = await resolveOwnerByToken(body.ownerToken);
  if (!owner) {
    res.status(404).json({ error: "Owner not found" });
    return;
  }
  const title = body.title.trim();
  if (!title) {
    res.status(400).json({ error: "title required" });
    return;
  }
  if (body.kind === "royalty") {
    const err = validateRoyaltyConfig({
      royaltyBasis: body.royaltyBasis ?? null,
      royaltyValue: body.royaltyValue ?? null,
      royaltySource: body.royaltySource ?? null,
    });
    if (err) {
      res.status(400).json({ error: err });
      return;
    }
  } else if (body.kind === "sponsor") {
    const err = validateSponsorConfig({
      budgetLzt: body.budgetLzt ?? null,
      sponsorHostPerMinuteLzt: body.sponsorHostPerMinuteLzt ?? null,
      sponsorPlayerPerMinuteLzt: body.sponsorPlayerPerMinuteLzt ?? null,
    });
    if (err) {
      res.status(400).json({ error: err });
      return;
    }
  }

  const accessCode =
    body.visibility === "private" ? generateAccessCode() : null;

  let devKeyId: string | null = null;
  if (body.apiKey && body.apiKey.trim()) {
    const [devKey] = await db
      .select({ id: devKeysTable.id })
      .from(devKeysTable)
      .where(eq(devKeysTable.apiKey, body.apiKey.trim()));
    if (!devKey) {
      res.status(404).json({ error: "API key not found" });
      return;
    }
    const [existing] = await db
      .select({ id: quotasTable.id })
      .from(quotasTable)
      .where(eq(quotasTable.devKeyId, devKey.id));
    if (existing) {
      res.status(400).json({ error: "This API key already has a linked quota" });
      return;
    }
    devKeyId = devKey.id;
  }

  let created;
  try {
    [created] = await db
    .insert(quotasTable)
    .values({
      ownerType: owner.type,
      ownerId: owner.id,
      kind: body.kind,
      status: "draft",
      title,
      description: body.description ?? "",
      gameId: body.gameId ?? null,
      visibility: body.visibility,
      accessCode,
      devKeyId,
      minSessionMinutes: body.minSessionMinutes ?? null,
      maxSessionMinutes: body.maxSessionMinutes ?? null,
      startAt: body.startAt ? new Date(body.startAt) : new Date(),
      endAt: body.endAt ? new Date(body.endAt) : null,
      budgetLzt: body.kind === "sponsor" ? body.budgetLzt ?? null : null,
      escrowRemainingLzt: null,
      sponsorHostPerMinuteLzt:
        body.kind === "sponsor" ? body.sponsorHostPerMinuteLzt ?? null : null,
      sponsorPlayerPerMinuteLzt:
        body.kind === "sponsor"
          ? body.sponsorPlayerPerMinuteLzt ?? null
          : null,
      royaltyBasis: body.kind === "royalty" ? body.royaltyBasis ?? null : null,
      royaltyValue: body.kind === "royalty" ? body.royaltyValue ?? null : null,
      royaltySource:
        body.kind === "royalty" ? body.royaltySource ?? null : null,
      recGpuVram: body.recGpuVram ?? null,
      recCpuCores: body.recCpuCores ?? null,
      recRamGb: body.recRamGb ?? null,
      recDownloadMbps: body.recDownloadMbps ?? null,
      recUploadMbps: body.recUploadMbps ?? null,
      requiredTier: body.requiredTier ?? "min",
      minGpuVram: body.minGpuVram ?? null,
      minCpuCores: body.minCpuCores ?? null,
      minRamGb: body.minRamGb ?? null,
      minDownloadMbps: body.minDownloadMbps ?? null,
      minUploadMbps: body.minUploadMbps ?? null,
    })
    .returning();
  } catch (err) {
    // Race guard: DB-level partial unique index on devKeyId catches
    // concurrent requests linking two quotas to the same key.
    if (isUniqueViolation(err)) {
      res.status(400).json({ error: "This API key already has a linked quota" });
      return;
    }
    throw err;
  }
  if (!created) {
    res.status(500).json({ error: "Failed to create quota" });
    return;
  }
  const [decorated] = await decorate([created], {
    includeAccessCodeForOwnerId: owner.id,
  });
  res.status(201).json(decorated);
});

// ---------- Update (only while draft AND no movement) ----------

router.patch("/quotas/:id", async (req, res): Promise<void> => {
  const id = req.params.id ?? "";
  const parsed = UpdateQuotaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const owner = await resolveOwnerByToken(parsed.data.ownerToken);
  if (!owner) {
    res.status(403).json({ error: "Not owner" });
    return;
  }
  const [quota] = await db
    .select()
    .from(quotasTable)
    .where(eq(quotasTable.id, id));
  if (!quota) {
    res.status(404).json({ error: "Quota not found" });
    return;
  }
  if (quota.ownerId !== owner.id || quota.ownerType !== owner.type) {
    res.status(403).json({ error: "Not your quota" });
    return;
  }
  // Edits are locked once the quota has any movement OR an active attachment,
  // regardless of status — even a `paused` sponsor quota that has been used
  // can't change its budget/rates without breaking already-credited math.
  const [seen] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(billingEventsTable)
    .where(eq(billingEventsTable.quotaId, quota.id));
  const [attached] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(quotaSessionsTable)
    .where(eq(quotaSessionsTable.quotaId, quota.id));
  if (Number(seen?.n ?? 0) > 0 || Number(attached?.n ?? 0) > 0) {
    res
      .status(400)
      .json({ error: "Cannot edit a quota that has movements or attached sessions" });
    return;
  }
  if (quota.status === "closed" || quota.status === "expired") {
    res
      .status(400)
      .json({ error: `Cannot edit a ${quota.status} quota` });
    return;
  }

  const b = parsed.data;
  const updates: Partial<typeof quotasTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (b.title !== undefined) updates.title = b.title;
  if (b.description !== undefined) updates.description = b.description;
  if (b.gameId !== undefined) updates.gameId = b.gameId;
  if (b.visibility !== undefined) updates.visibility = b.visibility;
  if (b.minSessionMinutes !== undefined)
    updates.minSessionMinutes = b.minSessionMinutes;
  if (b.maxSessionMinutes !== undefined)
    updates.maxSessionMinutes = b.maxSessionMinutes;
  if (b.endAt !== undefined)
    updates.endAt = b.endAt ? new Date(b.endAt) : null;
  if (b.budgetLzt !== undefined) updates.budgetLzt = b.budgetLzt;
  if (b.sponsorHostPerMinuteLzt !== undefined)
    updates.sponsorHostPerMinuteLzt = b.sponsorHostPerMinuteLzt;
  if (b.sponsorPlayerPerMinuteLzt !== undefined)
    updates.sponsorPlayerPerMinuteLzt = b.sponsorPlayerPerMinuteLzt;
  if (b.royaltyBasis !== undefined) updates.royaltyBasis = b.royaltyBasis;
  if (b.royaltyValue !== undefined) updates.royaltyValue = b.royaltyValue;
  if (b.royaltySource !== undefined) updates.royaltySource = b.royaltySource;
  if (b.minGpuVram !== undefined) updates.minGpuVram = b.minGpuVram;
  if (b.minCpuCores !== undefined) updates.minCpuCores = b.minCpuCores;
  if (b.minRamGb !== undefined) updates.minRamGb = b.minRamGb;
  if (b.minDownloadMbps !== undefined) updates.minDownloadMbps = b.minDownloadMbps;
  if (b.minUploadMbps !== undefined) updates.minUploadMbps = b.minUploadMbps;
  if (b.recGpuVram !== undefined) updates.recGpuVram = b.recGpuVram;
  if (b.recCpuCores !== undefined) updates.recCpuCores = b.recCpuCores;
  if (b.recRamGb !== undefined) updates.recRamGb = b.recRamGb;
  if (b.recDownloadMbps !== undefined) updates.recDownloadMbps = b.recDownloadMbps;
  if (b.recUploadMbps !== undefined) updates.recUploadMbps = b.recUploadMbps;
  if (b.requiredTier !== undefined) updates.requiredTier = b.requiredTier ?? "min";
  // private→public clears the access code; public→private mints a new one.
  if (b.visibility === "public") updates.accessCode = null;
  if (b.visibility === "private" && !quota.accessCode)
    updates.accessCode = generateAccessCode();

  if (b.apiKey !== undefined) {
    const trimmed = b.apiKey?.trim() ?? "";
    if (!trimmed) {
      updates.devKeyId = null;
    } else {
      const [devKey] = await db
        .select({ id: devKeysTable.id })
        .from(devKeysTable)
        .where(eq(devKeysTable.apiKey, trimmed));
      if (!devKey) {
        res.status(404).json({ error: "API key not found" });
        return;
      }
      const [existing] = await db
        .select({ id: quotasTable.id })
        .from(quotasTable)
        .where(eq(quotasTable.devKeyId, devKey.id));
      if (existing && existing.id !== quota.id) {
        res.status(400).json({ error: "This API key already has a linked quota" });
        return;
      }
      updates.devKeyId = devKey.id;
    }
  }

  let updated;
  try {
    [updated] = await db
      .update(quotasTable)
      .set(updates)
      .where(eq(quotasTable.id, quota.id))
      .returning();
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(400).json({ error: "This API key already has a linked quota" });
      return;
    }
    throw err;
  }
  if (!updated) {
    res.status(500).json({ error: "Failed to update quota" });
    return;
  }
  const [decorated] = await decorate([updated], {
    includeAccessCodeForOwnerId: owner.id,
  });
  res.json(decorated);
});

// ---------- Publish ----------

router.post("/quotas/:id/publish", async (req, res): Promise<void> => {
  const id = req.params.id ?? "";
  const parsed = QuotaOwnerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const owner = await resolveOwnerByToken(parsed.data.ownerToken);
  if (!owner) {
    res.status(403).json({ error: "Not owner" });
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [quota] = await tx
        .select()
        .from(quotasTable)
        .where(eq(quotasTable.id, id));
      if (!quota) return { http: 404 as const, error: "Quota not found" };
      if (quota.ownerId !== owner.id || quota.ownerType !== owner.type) {
        return { http: 403 as const, error: "Not your quota" };
      }
      if (quota.status !== "draft" && quota.status !== "paused") {
        return {
          http: 400 as const,
          error: `Cannot publish a ${quota.status} quota`,
        };
      }

      if (quota.kind === "royalty") {
        const err = validateRoyaltyConfig(quota);
        if (err) return { http: 400 as const, error: err };
      } else {
        const err = validateSponsorConfig(quota);
        if (err) return { http: 400 as const, error: err };
      }

      let escrowRemainingLzt = quota.escrowRemainingLzt;
      // Lock escrow on the first publish (draft) AND on resume from paused
      // (we refunded on pause), so a paused sponsor quota can never reach
      // active with zero escrow.
      const needsLock =
        quota.kind === "sponsor" &&
        (quota.status === "draft" ||
          (quota.status === "paused" && (escrowRemainingLzt ?? 0) <= 0));
      if (needsLock) {
        const lock = quota.budgetLzt ?? 0;
        // Atomic: only lock if the owner's green covers it.
        const balanceTable =
          owner.type === "host" ? hostsTable : playersTable;
        const debited = await tx
          .update(balanceTable)
          .set({
            withdrawableBalanceLzt: sql`${balanceTable.withdrawableBalanceLzt} - ${lock}`,
          })
          .where(
            and(
              eq(balanceTable.id, owner.id),
              sql`${balanceTable.withdrawableBalanceLzt} >= ${lock}`,
            ),
          )
          .returning({ id: balanceTable.id });
        if (debited.length === 0) {
          return {
            http: 400 as const,
            error: `Insufficient green balance to lock ${lock} LZT escrow`,
          };
        }
        escrowRemainingLzt = lock;
        await tx.insert(billingEventsTable).values({
          sessionId: quota.id, // re-use id; no session ref for escrow ops
          hostId: owner.type === "host" ? owner.id : "00000000-0000-0000-0000-000000000000",
          playerId: owner.type === "player" ? owner.id : "00000000-0000-0000-0000-000000000000",
          minutes: 0,
          bucket: "green",
          playerDebitLzt: owner.type === "player" ? lock : 0,
          hostCreditLzt: owner.type === "host" ? -lock : -lock,
          kind: "quota_escrow_lock",
          quotaId: quota.id,
        });
      }

      const [updated] = await tx
        .update(quotasTable)
        .set({
          status: "active",
          escrowRemainingLzt,
          updatedAt: new Date(),
        })
        .where(eq(quotasTable.id, quota.id))
        .returning();
      return { http: 200 as const, quota: updated! };
    });

    if (result.http !== 200) {
      res.status(result.http).json({ error: result.error });
      return;
    }
    const [decorated] = await decorate([result.quota], {
      includeAccessCodeForOwnerId: owner.id,
    });
    res.json(decorated);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Publish failed",
    });
  }
});

// ---------- Pause ----------

router.post("/quotas/:id/pause", async (req, res): Promise<void> => {
  const id = req.params.id ?? "";
  const parsed = QuotaOwnerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const owner = await resolveOwnerByToken(parsed.data.ownerToken);
  if (!owner) {
    res.status(403).json({ error: "Not owner" });
    return;
  }
  try {
    const result = await db.transaction(async (tx) => {
      // SELECT … FOR UPDATE — block concurrent billing ticks so we refund
      // exactly the locked-but-unspent amount.
      const [quota] = await tx
        .select()
        .from(quotasTable)
        .where(eq(quotasTable.id, id))
        .for("update");
      if (!quota) return { http: 404 as const, error: "Quota not found" };
      if (quota.ownerId !== owner.id || quota.ownerType !== owner.type) {
        return { http: 403 as const, error: "Not your quota" };
      }
      if (quota.status !== "active") {
        return {
          http: 400 as const,
          error: `Cannot pause a ${quota.status} quota`,
        };
      }
      await tx
        .update(sessionsTable)
        .set({ quotaId: null })
        .where(eq(sessionsTable.quotaId, quota.id));
      await tx
        .update(quotaSessionsTable)
        .set({ detachedAt: new Date() })
        .where(
          and(
            eq(quotaSessionsTable.quotaId, quota.id),
            isNull(quotaSessionsTable.detachedAt),
          ),
        );
      const refund =
        quota.kind === "sponsor" ? quota.escrowRemainingLzt ?? 0 : 0;
      if (refund > 0) {
        await creditOwnerGreen(tx, owner.type, owner.id, refund);
        await tx.insert(billingEventsTable).values({
          sessionId: quota.id,
          hostId:
            owner.type === "host"
              ? owner.id
              : "00000000-0000-0000-0000-000000000000",
          playerId:
            owner.type === "player"
              ? owner.id
              : "00000000-0000-0000-0000-000000000000",
          minutes: 0,
          bucket: "green",
          playerDebitLzt: 0,
          hostCreditLzt: refund,
          kind: "quota_escrow_refund",
          quotaId: quota.id,
        });
      }
      const [u] = await tx
        .update(quotasTable)
        .set({
          status: "paused",
          escrowRemainingLzt:
            quota.kind === "sponsor" ? 0 : quota.escrowRemainingLzt,
          updatedAt: new Date(),
        })
        .where(eq(quotasTable.id, quota.id))
        .returning();
      return { http: 200 as const, quota: u! };
    });
    if (result.http !== 200) {
      res.status(result.http).json({ error: result.error });
      return;
    }
    const [decorated] = await decorate([result.quota], {
      includeAccessCodeForOwnerId: owner.id,
    });
    res.json(decorated);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Pause failed",
    });
  }
});

// ---------- Close (refund remaining escrow) ----------

router.post("/quotas/:id/close", async (req, res): Promise<void> => {
  const id = req.params.id ?? "";
  const parsed = QuotaOwnerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const owner = await resolveOwnerByToken(parsed.data.ownerToken);
  if (!owner) {
    res.status(403).json({ error: "Not owner" });
    return;
  }
  try {
    const result = await db.transaction(async (tx) => {
      const [quota] = await tx
        .select()
        .from(quotasTable)
        .where(eq(quotasTable.id, id))
        .for("update");
      if (!quota) return { http: 404 as const, error: "Quota not found" };
      if (quota.ownerId !== owner.id || quota.ownerType !== owner.type) {
        return { http: 403 as const, error: "Not your quota" };
      }
      if (quota.status === "closed") {
        return { http: 400 as const, error: "Already closed" };
      }
      // Detach from any session that still references it; sessions keep running.
      await tx
        .update(sessionsTable)
        .set({ quotaId: null })
        .where(eq(sessionsTable.quotaId, quota.id));
      await tx
        .update(quotaSessionsTable)
        .set({ detachedAt: new Date() })
        .where(
          and(
            eq(quotaSessionsTable.quotaId, quota.id),
            isNull(quotaSessionsTable.detachedAt),
          ),
        );
      const refund = quota.escrowRemainingLzt ?? 0;
      if (refund > 0) {
        await creditOwnerGreen(tx, owner.type, owner.id, refund);
        await tx.insert(billingEventsTable).values({
          sessionId: quota.id,
          hostId:
            owner.type === "host"
              ? owner.id
              : "00000000-0000-0000-0000-000000000000",
          playerId:
            owner.type === "player"
              ? owner.id
              : "00000000-0000-0000-0000-000000000000",
          minutes: 0,
          bucket: "green",
          playerDebitLzt: 0,
          hostCreditLzt: refund,
          kind: "quota_escrow_refund",
          quotaId: quota.id,
        });
      }
      const [updated] = await tx
        .update(quotasTable)
        .set({
          status: "closed",
          escrowRemainingLzt: 0,
          updatedAt: new Date(),
        })
        .where(eq(quotasTable.id, quota.id))
        .returning();
      return { http: 200 as const, quota: updated! };
    });
    if (result.http !== 200) {
      res.status(result.http).json({ error: result.error });
      return;
    }
    const [decorated] = await decorate([result.quota], {
      includeAccessCodeForOwnerId: owner.id,
    });
    res.json(decorated);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Close failed",
    });
  }
});

// ---------- Regenerate access code ----------

router.post(
  "/quotas/:id/regenerate-code",
  async (req, res): Promise<void> => {
    const id = req.params.id ?? "";
    const parsed = QuotaOwnerBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const owner = await resolveOwnerByToken(parsed.data.ownerToken);
    if (!owner) {
      res.status(403).json({ error: "Not owner" });
      return;
    }
    const [quota] = await db
      .select()
      .from(quotasTable)
      .where(eq(quotasTable.id, id));
    if (!quota) {
      res.status(404).json({ error: "Quota not found" });
      return;
    }
    if (quota.ownerId !== owner.id || quota.ownerType !== owner.type) {
      res.status(403).json({ error: "Not your quota" });
      return;
    }
    if (quota.visibility !== "private") {
      res.status(400).json({ error: "Quota is not private" });
      return;
    }
    const [updated] = await db
      .update(quotasTable)
      .set({ accessCode: generateAccessCode(), updatedAt: new Date() })
      .where(eq(quotasTable.id, quota.id))
      .returning();
    const [decorated] = await decorate([updated!], {
      includeAccessCodeForOwnerId: owner.id,
    });
    res.json(decorated);
  },
);

export default router;
