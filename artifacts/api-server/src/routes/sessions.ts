import { Router, type IRouter } from "express";
import { eq, and, or, isNull, ne, sql } from "drizzle-orm";
import {
  db,
  gamesTable,
  hostsTable,
  hostGamesTable,
  playersTable,
  sessionsTable,
  billingEventsTable,
  quotasTable,
  quotaSessionsTable,
} from "@workspace/db";
import { isQuotaActiveNow } from "../lib/quotaEngine";
import {
  CreateBrowserHostSessionBody,
  CreateSessionBody,
  GetSessionResponse,
  GetSessionParams,
  GetSessionQueryParams,
  GetSessionByPlayerTokenParams,
  GetSessionByPlayerTokenResponse,
  EndSessionParams,
  EndSessionBody,
  EndSessionResponse,
  ClaimSessionParams,
  ClaimSessionBody,
  ClaimSessionResponse,
} from "@workspace/api-zod";

import { generateToken } from "../lib/tokens";
import { applyLaunchFee } from "../lib/launchFee";
import { pickPlayerBucket } from "../lib/lzt";
import { isHostAvailableNow } from "../lib/schedule";

const router: IRouter = Router();

function serialize(s: typeof sessionsTable.$inferSelect) {
  return {
    ...s,
    ratePerMinute: Number(s.ratePerMinute),
  };
}

router.post("/sessions", async (req, res): Promise<void> => {
  const parsed = CreateSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [host] = await db
    .select()
    .from(hostsTable)
    .where(eq(hostsTable.hostToken, parsed.data.hostToken));

  if (!host) {
    res.status(404).json({ error: "Host not found" });
    return;
  }

  // Reject session creation when the host is outside their declared
  // schedule window — the agent wouldn't accept the connection anyway.
  if (
    !isHostAvailableNow(
      host.scheduleMode,
      host.scheduleJson ?? [],
      new Date(),
    )
  ) {
    res.status(409).json({ error: "Host is not currently available" });
    return;
  }

  // One active session per host machine — the host agent can only stream one
  // game at a time (hardware constraint). Reject creation if a non-ended
  // session already exists for this host.
  const [existingActive] = await db
    .select({ id: sessionsTable.id })
    .from(sessionsTable)
    .where(
      and(
        eq(sessionsTable.hostId, host.id),
        ne(sessionsTable.status, "ended"),
      ),
    )
    .limit(1);
  if (existingActive) {
    res.status(409).json({ error: "host_busy" });
    return;
  }

  const playerToken = generateToken();

  // Optional: caller may specify which game from the host's multi-game
  // library this session is for. When provided we use that entry's
  // pricePerMinuteLzt; otherwise we fall back to the host's legacy
  // minutePriceUsd field.
  const requestedGameId =
    (req.body as { requestedGameId?: string } | undefined)?.requestedGameId ??
    null;
  let resolvedGameId: string | null = null;
  let ratePerMinute: number;

  if (requestedGameId) {
    const [libEntry] = await db
      .select()
      .from(hostGamesTable)
      .where(
        and(
          eq(hostGamesTable.hostId, host.id),
          eq(hostGamesTable.gameId, requestedGameId),
          eq(hostGamesTable.enabled, true),
        ),
      );
    if (!libEntry) {
      // Only reject if host actually has a library. Legacy (single-profile)
      // hosts without any library entries silently ignore requestedGameId and
      // fall back to their host-level binding — this preserves backward compat
      // for old host agents that don't know about multi-game libraries yet.
      const [anyLibEntry] = await db
        .select({ id: hostGamesTable.id })
        .from(hostGamesTable)
        .where(eq(hostGamesTable.hostId, host.id))
        .limit(1);
      if (anyLibEntry) {
        res
          .status(400)
          .json({ error: "Requested game is not in host's library or is disabled" });
        return;
      }
      // Legacy fallback: host has no library, ignore requestedGameId.
      ratePerMinute = Number(host.minutePriceUsd);
      resolvedGameId = host.gameId ?? null;
    } else {
      resolvedGameId = libEntry.gameId;
      // Convert integer LZT price to USD for the ratePerMinute field that the
      // billing worker currently uses. 200 LZT = 1 USDT = 1 USD (platform rate).
      ratePerMinute = libEntry.pricePerMinuteLzt / 200;
    }
  } else {
    // Legacy: use the host-level minutePriceUsd and bind to legacy gameId.
    ratePerMinute = Number(host.minutePriceUsd);
    resolvedGameId = host.gameId ?? null;
  }

  if (!Number.isFinite(ratePerMinute) || Math.abs(ratePerMinute) > 1000) {
    res.status(400).json({ error: "Host's minute price is invalid" });
    return;
  }

  // sessions.gameId is NOT NULL in the DB — reject creation if we couldn't
  // resolve a game binding through any path (library, host.gameId, or appName).
  if (!resolvedGameId) {
    res.status(400).json({
      error:
        "Host has no game binding. Add at least one game to the host library or set a gameId on the host profile before creating a session.",
    });
    return;
  }

  // Optional quota attachment. The host can pre-pick a quota in /host/setup
  // or by passing an access code; we validate it before creating the session.
  let resolvedQuotaId: string | null = null;
  const requestedQuotaId =
    (req.body as { quotaId?: string | null } | undefined)?.quotaId ?? null;
  const accessCode =
    (req.body as { quotaAccessCode?: string } | undefined)
      ?.quotaAccessCode ?? "";
  if (requestedQuotaId) {
    const [quota] = await db
      .select()
      .from(quotasTable)
      .where(eq(quotasTable.id, requestedQuotaId));
    if (!quota || !isQuotaActiveNow(quota)) {
      res.status(400).json({ error: "Quota is not active" });
      return;
    }
    const ownsIt =
      quota.ownerType === "host" && quota.ownerId === host.id;
    if (!ownsIt && quota.visibility === "private") {
      if (!accessCode || accessCode !== quota.accessCode) {
        res
          .status(400)
          .json({ error: "Invalid access code for private quota" });
        return;
      }
    }
    // Game binding is enforced for every attachment, including the owner's
    // own quotas: if a quota declares a game, the host MUST be bound to that
    // exact game.
    if (quota.gameId && quota.gameId !== (resolvedGameId ?? host.gameId)) {
      res
        .status(400)
        .json({ error: "Quota is bound to a different game" });
      return;
    }
    // PC specs check: enforce all four quota thresholds against the host's
    // reported pcSpecs. Fields that the host hasn't reported (cpuCores,
    // downloadMbps) are skipped so existing hosts are not broken; RAM is
    // always present; VRAM is parsed best-effort from the GPU name string.
    const specs = host.pcSpecs;
    if (specs) {
      // Build human-readable host/quota descriptions for error messages.
      const vramMatch = specs.gpu.match(/(\d+)\s*GB/i);
      const hostVram = vramMatch ? parseInt(vramMatch[1], 10) : null;

      const violations: string[] = [];

      if (quota.minGpuVram != null && hostVram != null && hostVram < quota.minGpuVram) {
        violations.push(`GPU VRAM: хост ${hostVram} GB, минимум ${quota.minGpuVram} GB`);
      }
      if (quota.minCpuCores != null && specs.cpuCores != null && specs.cpuCores < quota.minCpuCores) {
        violations.push(`CPU ядра: хост ${specs.cpuCores}, минимум ${quota.minCpuCores}`);
      }
      if (quota.minRamGb != null && specs.ramGb < quota.minRamGb) {
        violations.push(`RAM: хост ${specs.ramGb} GB, минимум ${quota.minRamGb} GB`);
      }
      if (quota.minDownloadMbps != null && specs.downloadMbps != null && specs.downloadMbps < quota.minDownloadMbps) {
        violations.push(`Интернет: хост ${specs.downloadMbps} Мбит/с, минимум ${quota.minDownloadMbps} Мбит/с`);
      }
      if (quota.minUploadMbps != null && specs.uploadMbps != null && specs.uploadMbps < quota.minUploadMbps) {
        violations.push(`Аплоад: хост ${specs.uploadMbps} Мбит/с, минимум ${quota.minUploadMbps} Мбит/с`);
      }

      if (violations.length > 0) {
        res.status(400).json({
          error: `ПК хоста (${specs.gpu}, ${specs.ramGb} GB RAM) ниже минимальных требований квоты: ${violations.join("; ")}`,
        });
        return;
      }
    }
    resolvedQuotaId = quota.id;
  }

  const [session] = await db
    .insert(sessionsTable)
    .values({
      hostId: host.id,
      gameId: resolvedGameId,
      playerToken,
      appName: parsed.data.appName,
      resolution: parsed.data.resolution ?? "1920x1080",
      bitrateKbps: parsed.data.bitrateKbps ?? 6000,
      ratePerMinute: String(ratePerMinute),
      paymentSource: parsed.data.paymentSource ?? "auto",
      quotaId: resolvedQuotaId,
    })
    .returning();

  if (!session) {
    res.status(500).json({ error: "Failed to create session" });
    return;
  }

  if (resolvedQuotaId) {
    await db
      .insert(quotaSessionsTable)
      .values({ quotaId: resolvedQuotaId, sessionId: session.id });
  }

  req.log.info(
    { sessionId: session.id, quotaId: resolvedQuotaId },
    "Session created",
  );
  res.status(201).json(GetSessionResponse.parse(serialize(session)));
});

// Create a session whose host is the calling browser. We mint a fresh host
// row for this session (so existing per-host plumbing — billing, signaling,
// activity, withdrawals — works unchanged) and return its hostToken to the
// caller. The caller is responsible for storing the hostToken locally
// (sessions are throwaway, so it never goes back to the server).
router.post("/sessions/browser-host", async (req, res): Promise<void> => {
  const parsed = CreateBrowserHostSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [player] = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.playerToken, parsed.data.playerWalletToken));
  if (!player) {
    res.status(404).json({ error: "Player wallet not found" });
    return;
  }
  const [game] = await db
    .select()
    .from(gamesTable)
    .where(eq(gamesTable.slug, parsed.data.gameSlug));
  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }
  if (!game.browserHostUrl) {
    res
      .status(400)
      .json({ error: "This game does not support browser-host mode" });
    return;
  }

  const hostToken = generateToken();
  const [host] = await db
    .insert(hostsTable)
    .values({
      hostToken,
      displayName: `${player.displayName} (browser host)`,
      gameId: game.id,
      boundUrl: game.browserHostUrl,
      boundAppLabel: game.title,
      description: `Browser-hosted session of ${game.title}.`,
      // Browser-host sessions are always available while the tab is open.
      scheduleMode: "always",
      // Default per-minute price. The host page can surface its own pricing
      // controls later; for the test we use the platform default.
      minutePriceUsd: "0.04",
      launchPriceUsd: "0",
    })
    .returning();
  if (!host) {
    res.status(500).json({ error: "Failed to create browser host" });
    return;
  }

  const playerToken = generateToken();
  const [session] = await db
    .insert(sessionsTable)
    .values({
      hostId: host.id,
      gameId: game.id,
      playerToken,
      appName: game.title,
      resolution: "1280x720",
      bitrateKbps: 4000,
      ratePerMinute: String(Number(host.minutePriceUsd)),
      paymentSource: "auto",
    })
    .returning();
  if (!session) {
    res.status(500).json({ error: "Failed to create session" });
    return;
  }

  req.log.info(
    { sessionId: session.id, hostId: host.id, gameSlug: game.slug },
    "Browser-host session created",
  );
  res.status(201).json({
    session: serialize(session),
    hostToken,
    browserHostUrl: game.browserHostUrl,
  });
});

router.get(
  "/sessions/by-player-token/:playerToken",
  async (req, res): Promise<void> => {
    const params = GetSessionByPlayerTokenParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const rows = await db
      .select({
        session: sessionsTable,
        game: {
          slug: gamesTable.slug,
          coverImageUrl: gamesTable.coverImageUrl,
          title: gamesTable.title,
        },
      })
      .from(sessionsTable)
      .leftJoin(gamesTable, eq(sessionsTable.gameId, gamesTable.id))
      .where(eq(sessionsTable.playerToken, params.data.playerToken));

    if (rows.length === 0) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const { session, game } = rows[0];

    // Return strict-schema fields plus extra game info for the player UI.
    res.json({
      ...GetSessionByPlayerTokenResponse.parse(serialize(session)),
      gameSlug: game?.slug ?? null,
      gameCoverImageUrl: game?.coverImageUrl ?? null,
      gameTitle: game?.title ?? null,
    });
  },
);

router.post(
  "/sessions/by-player-token/:playerToken/claim",
  async (req, res): Promise<void> => {
    const params = ClaimSessionParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const body = ClaimSessionBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const [session] = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.playerToken, params.data.playerToken));
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    if (session.status === "ended") {
      res.status(400).json({ error: "Session has ended" });
      return;
    }

    const [player] = await db
      .select()
      .from(playersTable)
      .where(eq(playersTable.playerToken, body.data.playerWalletToken));
    if (!player) {
      res.status(404).json({ error: "Player wallet not found" });
      return;
    }

    if (
      session.claimedByPlayerId &&
      session.claimedByPlayerId !== player.id
    ) {
      res.status(400).json({ error: "Session already claimed by another player" });
      return;
    }
    // Re-claim by the same player must be idempotent: do NOT charge the launch
    // fee a second time.
    const isReclaimBySamePlayer = session.claimedByPlayerId === player.id;

    // Player gets to pick the LZT bucket they're paying from. If they didn't
    // specify, keep whatever the session was created with (defaulting to
    // "auto"). Persist now so the rest of the claim path — balance check,
    // launch fee, signaling, billing worker — all see the same source.
    const chosenPaymentSource = body.data.paymentSource ?? session.paymentSource;
    if (chosenPaymentSource !== session.paymentSource) {
      await db
        .update(sessionsTable)
        .set({ paymentSource: chosenPaymentSource })
        .where(eq(sessionsTable.id, session.id));
      session.paymentSource = chosenPaymentSource;
    }

    // Lookup host to compute pre-claim balance requirement (launch fee +
    // one minute of streaming if the per-minute rate is positive).
    const [host] = await db
      .select()
      .from(hostsTable)
      .where(eq(hostsTable.id, session.hostId));
    if (!host) {
      res.status(404).json({ error: "Host not found" });
      return;
    }

    const launchFee = Number(host.launchPriceUsd);
    const perMinute = Number(session.ratePerMinute);
    // We require a single bucket to cover both the (positive) launch fee AND
    // one minute of streaming. We must not let "auto" combine buckets here —
    // billing debits from one bucket at a time, so a combined total can pass
    // this check but immediately fail on the first tick.
    const launchFeeLzt = Math.round(Math.max(0, launchFee) * 200);
    const perMinuteLzt = Math.round(Math.max(0, perMinute) * 200);
    const minBalanceLzt = launchFeeLzt + perMinuteLzt;
    const picked = pickPlayerBucket(
      session.paymentSource,
      minBalanceLzt,
      player.withdrawableBalanceLzt,
      player.internalBalanceLzt,
    );
    // Block billing: if the player chose a block, require the full block reserve
    // (blockMinutes × perMinuteLzt) to be present in a single bucket, plus the launch fee.
    const blockMinutes = body.data.blockMinutes ?? null;
    const ratePerMinuteLzt = Math.round(perMinute * 200);
    const blockReservedLzt =
      blockMinutes !== null && ratePerMinuteLzt > 0
        ? blockMinutes * ratePerMinuteLzt
        : null;

    // Override minBalanceLzt with block reserve when applicable.
    // For zero-rate hosts (pricePerMinuteLzt = 0) block logic is skipped.
    const effectiveMinLzt =
      blockReservedLzt !== null
        ? launchFeeLzt + blockReservedLzt
        : minBalanceLzt;
    const effectivePicked =
      effectiveMinLzt !== minBalanceLzt
        ? pickPlayerBucket(
            session.paymentSource,
            effectiveMinLzt,
            player.withdrawableBalanceLzt,
            player.internalBalanceLzt,
          )
        : picked;

    if (effectivePicked === null && effectiveMinLzt > 0) {
      const need = blockReservedLzt !== null
        ? `${effectiveMinLzt} LZT (блок ${blockMinutes} мин × ${ratePerMinuteLzt} LZT + запуск)`
        : `${effectiveMinLzt} LZT`;
      res.status(400).json({
        error: `Insufficient LZT — need at least ${need} in a single ${session.paymentSource === "auto" ? "(green or blue)" : session.paymentSource} bucket to start`,
      });
      return;
    }

    // Reserve the block amount: debit the player immediately so the funds are
    // locked. The billing worker will refund unused minutes on early exit.
    if (blockReservedLzt !== null && blockReservedLzt > 0 && !isReclaimBySamePlayer) {
      const bucket = effectivePicked ?? "balance";
      const playerCol =
        bucket === "green"
          ? playersTable.withdrawableBalanceLzt
          : playersTable.internalBalanceLzt;
      const debitResult = await db
        .update(playersTable)
        .set(
          bucket === "green"
            ? { withdrawableBalanceLzt: sql`${playersTable.withdrawableBalanceLzt} - ${blockReservedLzt}` }
            : { internalBalanceLzt: sql`${playersTable.internalBalanceLzt} - ${blockReservedLzt}` },
        )
        .where(
          and(
            eq(playersTable.id, player.id),
            sql`${playerCol} >= ${blockReservedLzt + launchFeeLzt}`,
          ),
        )
        .returning({ id: playersTable.id });
      if (debitResult.length === 0) {
        res.status(400).json({ error: "Insufficient balance to reserve the block" });
        return;
      }
    }

    if (picked === null && minBalanceLzt > 0 && blockReservedLzt === null) {
      res.status(400).json({
        error: `Insufficient LZT — need at least ${minBalanceLzt} LZT in a single ${session.paymentSource === "auto" ? "(green or blue)" : session.paymentSource} bucket to start`,
      });
      return;
    }

    const [updated] = await db
      .update(sessionsTable)
      .set({
        claimedByPlayerId: player.id,
        ...(blockMinutes !== null
          ? { blockMinutes, blockReservedLzt: blockReservedLzt ?? 0 }
          : {}),
      })
      .where(
        and(
          eq(sessionsTable.id, session.id),
          or(
            isNull(sessionsTable.claimedByPlayerId),
            eq(sessionsTable.claimedByPlayerId, player.id),
          ),
        ),
      )
      .returning();

    if (!updated) {
      res.status(409).json({ error: "Session already claimed by another player" });
      return;
    }

    // One-time launch fee transfer (no-op if launchPriceUsd is 0). Skipped on
    // an idempotent re-claim by the same player.
    if (!isReclaimBySamePlayer) {
      const fee = await applyLaunchFee({
        sessionId: updated.id,
        hostId: host.id,
        playerId: player.id,
        launchPriceUsd: launchFee,
        paymentSource: session.paymentSource,
      });
      if (!fee.ok) {
        // Roll back the claim so the player isn't stuck.
        await db
          .update(sessionsTable)
          .set({ claimedByPlayerId: null })
          .where(eq(sessionsTable.id, updated.id));
        res.status(400).json({ error: fee.reason ?? "Launch fee failed" });
        return;
      }
    }

    req.log.info(
      { sessionId: updated.id, playerId: player.id, launchFee },
      "Session claimed",
    );
    res.json(ClaimSessionResponse.parse(serialize(updated)));
  },
);

router.get("/sessions/:id", async (req, res): Promise<void> => {
  const params = GetSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const query = GetSessionQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const [host] = await db
    .select()
    .from(hostsTable)
    .where(eq(hostsTable.hostToken, query.data.hostToken));
  if (!host) {
    res.status(403).json({ error: "Invalid host token" });
    return;
  }

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, params.data.id));

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  if (session.hostId !== host.id) {
    res.status(403).json({ error: "Not your session" });
    return;
  }

  res.json(GetSessionResponse.parse(serialize(session)));
});

router.patch("/sessions/:id/end", async (req, res): Promise<void> => {
  const params = EndSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = EndSessionBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [host] = await db
    .select()
    .from(hostsTable)
    .where(eq(hostsTable.hostToken, body.data.hostToken));
  if (!host) {
    res.status(403).json({ error: "Invalid host token" });
    return;
  }

  const [existing] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  if (existing.hostId !== host.id) {
    res.status(403).json({ error: "Not your session" });
    return;
  }

  const now = new Date();

  // Block session early-exit refund: count minutes used, refund remainder.
  if (
    existing.blockMinutes &&
    existing.blockReservedLzt &&
    existing.claimedByPlayerId &&
    existing.status === "active"
  ) {
    try {
      const ticksRow = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(billingEventsTable)
        .where(
          and(
            eq(billingEventsTable.sessionId, existing.id),
            eq(billingEventsTable.kind, "session_tick"),
            eq(billingEventsTable.bucket, "green"),
          ),
        );
      const minutesUsed = Number(ticksRow[0]?.n ?? 0);
      const costPerMinute = Math.round(existing.blockReservedLzt / existing.blockMinutes);
      const costUsed = minutesUsed * costPerMinute;
      const refundLzt = Math.max(0, existing.blockReservedLzt - costUsed);
      if (refundLzt > 0) {
        const bucket = existing.paymentSource === "blue" ? "internalBalanceLzt" : "withdrawableBalanceLzt";
        await db
          .update(playersTable)
          .set({ [bucket]: sql`${playersTable[bucket as keyof typeof playersTable]} + ${refundLzt}` } as never)
          .where(eq(playersTable.id, existing.claimedByPlayerId));
        req.log.info({ sessionId: existing.id, refundLzt, minutesUsed }, "Block session early exit — refunded unused reserve");
      }
    } catch (err) {
      req.log.error({ err, sessionId: existing.id }, "Block refund failed during session end");
    }
  }

  const [session] = await db
    .update(sessionsTable)
    .set({ status: "ended", endedAt: now })
    .where(eq(sessionsTable.id, params.data.id))
    .returning();

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  req.log.info({ sessionId: session.id }, "Session ended");
  res.json(EndSessionResponse.parse(serialize(session)));
});

export default router;
