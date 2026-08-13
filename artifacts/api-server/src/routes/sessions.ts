import { Router, type IRouter } from "express";
import { eq, and, or, isNull, ne, sql } from "drizzle-orm";
import {
  db,
  gamesTable,
  hostsTable,
  hostGamesTable,
  playersTable,
  sessionsTable,
  quotasTable,
  quotaSessionsTable,
  sessionMetricsTable,
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
import { generateInviteCode, defaultInviteExpiresAt, isInviteExpired } from "../lib/invites";
import { applyLaunchFee } from "../lib/launchFee";
import { pickPlayerBucket } from "../lib/lzt";
import { isHostAvailableNow } from "../lib/schedule";
import { checkQuotaAttachment } from "../lib/quotaAttach";
import { headerUserToken } from "../lib/requestToken";
import { rateLimit, ipKey } from "../lib/rateLimit";
import {
  countSessionMinutesUsed,
  refundBlockRemainder,
} from "../lib/sessionBilling";
import { sendSignalingMessage } from "../lib/signaling";
import { submitSessionRating, recordBlockReserveLedger } from "../lib/ratings";
import { writeLedger } from "../lib/economy";
import { randomUUID } from "node:crypto";
import { z } from "zod/v4";

const router: IRouter = Router();

// Claim links a session to a wallet and can charge a launch fee. IP-keyed so
// session-token / wallet-token guessing hits the wall fast.
const claimLimiter = rateLimit({
  scope: "sessions:claim",
  windowMs: 60_000,
  max: 30, // keyed by token (default) — each player gets their own bucket
});

/** OpenAPI CreateSessionBody includes requestedGameId (uuid). */
function serialize(s: typeof sessionsTable.$inferSelect) {
  return {
    ...s,
    ratePerMinute: Number(s.ratePerMinute),
  };
}

function inviteFields() {
  return {
    inviteCode: generateInviteCode(),
    inviteExpiresAt: defaultInviteExpiresAt(),
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

  const playerToken = generateToken();

  // Optional: caller may specify which game from the host's multi-game
  // library this session is for. When provided we use that entry's
  // pricePerMinuteLzt; otherwise we fall back to the host's legacy
  // minutePriceUsd field.
  const requestedGameId = parsed.data.requestedGameId ?? null;
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
  const requestedQuotaId = parsed.data.quotaId ?? null;
  const accessCode = parsed.data.quotaAccessCode ?? "";
  if (requestedQuotaId) {
    const [quota] = await db
      .select()
      .from(quotasTable)
      .where(eq(quotasTable.id, requestedQuotaId));
    if (!quota || !isQuotaActiveNow(quota)) {
      res.status(400).json({ error: "Quota is not active" });
      return;
    }
    // Key-exclusive quota: only attachable via the linked dev key's
    // /embed/sessions call, never through this manual host/access-code path.
    if (quota.devKeyId) {
      res.status(400).json({
        error: "Эта квота привязана к API-ключу и подключается только через него",
      });
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
    // Game binding + PC-spec checks, shared with the dev-key auto-attach path
    // in embed.ts (see quotaAttach.ts for the STREAM_OVERHEAD rationale).
    const check = checkQuotaAttachment(quota, host, resolvedGameId);
    if (!check.ok) {
      res.status(400).json({ error: check.error });
      return;
    }
    resolvedQuotaId = quota.id;
  }

  // Serialize session creation per host: lock the host row then re-check busy.
  let session: typeof sessionsTable.$inferSelect | undefined;
  try {
    session = await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT id FROM hosts WHERE id = ${host.id} FOR UPDATE`,
      );
      const [existingActive] = await tx
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
        throw Object.assign(new Error("host_busy"), { code: "host_busy" });
      }
      const [created] = await tx
        .insert(sessionsTable)
        .values({
          hostId: host.id,
          gameId: resolvedGameId!,
          playerToken,
          ...inviteFields(),
          appName: parsed.data.appName,
          resolution: parsed.data.resolution ?? "1920x1080",
          bitrateKbps: parsed.data.bitrateKbps ?? 6000,
          ratePerMinute: String(ratePerMinute),
          paymentSource: parsed.data.paymentSource ?? "auto",
          quotaId: resolvedQuotaId,
        })
        .returning();
      if (!created) {
        throw new Error("Failed to create session");
      }
      if (resolvedQuotaId) {
        await tx
          .insert(quotaSessionsTable)
          .values({ quotaId: resolvedQuotaId, sessionId: created.id });
      }
      return created;
    });
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "host_busy"
    ) {
      res.status(409).json({ error: "host_busy" });
      return;
    }
    throw err;
  }

  if (!session) {
    res.status(500).json({ error: "Failed to create session" });
    return;
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
      displayName: `${player.displayName} (браузерный хост)`,
      gameId: game.id,
      boundUrl: game.browserHostUrl,
      boundAppLabel: game.title,
      description: `Браузерная сессия — ${game.title}.`,
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
      ...inviteFields(),
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

// Self-test sessions are free, so throttle creation hard: token guessing or
// spam would otherwise churn the sessions table at zero cost.
const testSessionLimiter = rateLimit({
  scope: "sessions:test",
  windowMs: 60_000,
  max: 5,
  keyFn: ipKey,
});

// Self-test session: the host launches a session against their own PC to
// verify the stream works end-to-end. Completely free — no launch fee, no
// per-minute billing (billing worker skips isTest), no earnings.
router.post("/sessions/test", testSessionLimiter, async (req, res): Promise<void> => {
  const hostToken =
    (req.headers["x-host-token"] as string | undefined) ||
    String(req.body?.hostToken ?? "");
  if (!hostToken) {
    res.status(401).json({ error: "hostToken required" });
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
  // 0. One-shot override URL from the dashboard "quick test" input.
  // 1. Host's own bound browser URL (boundUrl) from profile settings.
  // 2. Modern library (hostGamesTable) — first enabled entry.
  // 3. Legacy hosts.gameId.
  // 4. Any catalog game (browser-hosted first) — so test works even before
  //    the host has configured their library.
  const overrideUrl = (String(req.body?.overrideUrl ?? "")).trim();
  const hostBoundUrl = overrideUrl || (host.boundUrl ?? "").trim();
  let game: typeof gamesTable.$inferSelect | undefined;

  const [libraryEntry] = await db
    .select({ gameId: hostGamesTable.gameId })
    .from(hostGamesTable)
    .where(
      and(
        eq(hostGamesTable.hostId, host.id),
        eq(hostGamesTable.enabled, true),
      ),
    )
    .orderBy(hostGamesTable.sortOrder)
    .limit(1);

  const resolvedGameId = libraryEntry?.gameId ?? host.gameId;

  if (resolvedGameId) {
    const [found] = await db
      .select()
      .from(gamesTable)
      .where(eq(gamesTable.id, resolvedGameId));
    game = found;
  }

  // Fallback: pick any catalog game. Prefer browser-hosted so the test is
  // immediately playable in the browser without the desktop agent.
  if (!game) {
    const allGames = await db
      .select()
      .from(gamesTable)
      .orderBy(gamesTable.title);
    game = allGames.find((g) => g.browserHostUrl) ?? allGames[0];
  }

  if (!game) {
    res.status(400).json({
      error: "no_game",
      message: "В каталоге нет ни одной игры — обратитесь к администратору.",
    });
    return;
  }

  // Only one open test session per host at a time — end any stale ones.
  await db
    .update(sessionsTable)
    .set({ status: "ended", endedAt: new Date(), endReason: "test_superseded" })
    .where(
      and(
        eq(sessionsTable.hostId, host.id),
        eq(sessionsTable.isTest, true),
        ne(sessionsTable.status, "ended"),
      ),
    );

  // Same hardware constraint as /sessions: the host machine streams one game
  // at a time. If a real (paid) session is still open, don't preempt it.
  const [busy] = await db
    .select({ id: sessionsTable.id })
    .from(sessionsTable)
    .where(
      and(
        eq(sessionsTable.hostId, host.id),
        ne(sessionsTable.status, "ended"),
      ),
    )
    .limit(1);
  if (busy) {
    res.status(409).json({
      error: "host_busy",
      message: "У хоста уже идёт сессия — завершите её перед тестом.",
    });
    return;
  }

  const playerToken = generateToken();
  const [session] = await db
    .insert(sessionsTable)
    .values({
      hostId: host.id,
      gameId: game.id,
      playerToken,
      ...inviteFields(),
      appName: game.title,
      resolution: "1280x720",
      bitrateKbps: 4000,
      // Rate kept for display purposes only; billing worker skips isTest.
      ratePerMinute: String(Number(host.minutePriceUsd)),
      paymentSource: "auto",
      isTest: true,
      // When the host bound their own browser URL, show that in the player —
      // the catalog game row above is only used to satisfy the gameId FK.
      ...(hostBoundUrl
        ? {
            appName:
              host.boundAppLabel ||
              (() => {
                try {
                  return new URL(hostBoundUrl).hostname;
                } catch {
                  return game.title;
                }
              })(),
          }
        : {}),
    })
    .returning();
  if (!session) {
    res.status(500).json({ error: "Failed to create test session" });
    return;
  }

  req.log.info(
    { sessionId: session.id, hostId: host.id },
    "Test session created",
  );
  // hostBoundUrl lets the dashboard decide how to open the test:
  // external http(s) URL → host streaming page (tab capture via WebRTC);
  // local/relative game path → player iframe directly.
  res.status(201).json({
    session: serialize(session),
    hostBoundUrl: hostBoundUrl || null,
    isExternalUrl: /^https?:\/\//i.test(hostBoundUrl),
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
          browserHostUrl: gamesTable.browserHostUrl,
        },
        hostBoundUrl: hostsTable.boundUrl,
      })
      .from(sessionsTable)
      .leftJoin(gamesTable, eq(sessionsTable.gameId, gamesTable.id))
      .leftJoin(hostsTable, eq(sessionsTable.hostId, hostsTable.id))
      .where(eq(sessionsTable.playerToken, params.data.playerToken));

    if (rows.length === 0) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const { session, game, hostBoundUrl } = rows[0];

    // For self-test sessions the host's own bound browser URL wins over the
    // catalog game's URL — the host is testing exactly what they configured.
    // External http(s) URLs are NOT returned as iframe targets: arbitrary
    // sites block framing (X-Frame-Options), so the player must receive the
    // WebRTC stream from the host's shared tab instead.
    const boundTrimmed = (hostBoundUrl ?? "").trim();
    const boundIsExternal = /^https?:\/\//i.test(boundTrimmed);
    const effectiveBrowserUrl =
      session.isTest && boundTrimmed
        ? boundIsExternal
          ? null
          : boundTrimmed
        : game?.browserHostUrl ?? null;

    // Return strict-schema fields plus extra game info for the player UI.
    res.json({
      ...GetSessionByPlayerTokenResponse.parse(serialize(session)),
      gameSlug: game?.slug ?? null,
      gameCoverImageUrl: game?.coverImageUrl ?? null,
      gameTitle: session.isTest ? session.appName : game?.title ?? null,
      // For isTest sessions with a browser game, the play page renders an
      // iframe directly (no WebRTC / no agent needed).
      gameBrowserHostUrl: effectiveBrowserUrl,
    });
  },
);

router.post(
  "/sessions/by-player-token/:playerToken/claim",
  claimLimiter,
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
    if (session.devKeyId) {
      // Embed sessions are funded entirely by the dev key's own balance and
      // never involve a player wallet — the /embed widget skips the claim
      // step by design (see embed.ts). Reject any attempt to claim one.
      res.status(400).json({
        error: "embed_session_not_claimable",
        message: "This session was launched via an API key and cannot be claimed by a player.",
      });
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

    // Test sessions are free: skip balance requirements and the launch fee
    // entirely — just bind the wallet and let the stream start. The billing
    // worker never touches isTest sessions.
    if (session.isTest) {
      const [claimed] = await db
        .update(sessionsTable)
        .set({ claimedByPlayerId: player.id })
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
      if (!claimed) {
        res.status(409).json({ error: "Session already claimed by another player" });
        return;
      }
      req.log.info(
        { sessionId: claimed.id, playerId: player.id },
        "Test session claimed (free)",
      );
      res.json(ClaimSessionResponse.parse(serialize(claimed)));
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
      const ledgerBucket = bucket === "green" ? "green" : "blue";
      await recordBlockReserveLedger({
        playerId: player.id,
        sessionId: session.id,
        amountLzt: blockReservedLzt,
        bucket: ledgerBucket,
        note: `block reserve: ${blockMinutes} мин`,
      });
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
  // API client strips hostToken from query params and sends it as X-User-Token
  // header to keep secrets out of server logs. Accept both sources.
  const resolvedHostToken =
    headerUserToken(req) || String(req.query.hostToken ?? "");
  if (!resolvedHostToken) {
    res.status(403).json({ error: "Invalid host token" });
    return;
  }

  const [host] = await db
    .select()
    .from(hostsTable)
    .where(eq(hostsTable.hostToken, resolvedHostToken));
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

  let session: typeof existing | null;
  try {
    session = await db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(sessionsTable)
        .where(eq(sessionsTable.id, params.data.id))
        .for("update");
      if (!locked) return null;

      if (
        locked.blockMinutes &&
        locked.blockReservedLzt &&
        locked.claimedByPlayerId &&
        locked.status === "active"
      ) {
        const minutesUsed = await countSessionMinutesUsed(tx, locked.id);
        await refundBlockRemainder(tx, locked.id, minutesUsed);
      }

      const [ended] = await tx
        .update(sessionsTable)
        .set({ status: "ended", endedAt: now })
        .where(eq(sessionsTable.id, params.data.id))
        .returning();
      return ended;
    });
  } catch (err) {
    req.log.error({ err, sessionId: existing.id }, "Block refund failed during session end");
    res.status(500).json({ error: "Failed to end session" });
    return;
  }

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  req.log.info({ sessionId: session.id }, "Session ended");
  res.json(EndSessionResponse.parse(serialize(session)));
});

router.get("/sessions/by-invite/:inviteCode", async (req, res): Promise<void> => {
  const inviteCode = String(req.params.inviteCode ?? "").trim();
  if (!inviteCode) {
    res.status(400).json({ error: "inviteCode required" });
    return;
  }
  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.inviteCode, inviteCode));
  if (!session) {
    res.status(404).json({ error: "Invite not found" });
    return;
  }
  if (isInviteExpired(session.inviteExpiresAt)) {
    res.status(410).json({ error: "invite_expired", message: "Ссылка-приглашение истекла" });
    return;
  }

  const [game] = await db
    .select()
    .from(gamesTable)
    .where(eq(gamesTable.id, session.gameId));

  res.json({
    ...GetSessionByPlayerTokenResponse.parse(serialize(session)),
    inviteCode: session.inviteCode,
    gameSlug: game?.slug ?? null,
    gameCoverImageUrl: game?.coverImageUrl ?? null,
    gameTitle: session.isTest ? session.appName : game?.title ?? null,
    gameBrowserHostUrl: game?.browserHostUrl ?? null,
  });
});

router.post(
  "/sessions/by-player-token/:playerToken/renew-block",
  claimLimiter,
  async (req, res): Promise<void> => {
    const playerToken = String(req.params.playerToken ?? "").trim();
    const playerWalletToken = String(req.body?.playerWalletToken ?? "").trim();
    const blockMinutes = Number(req.body?.blockMinutes);
    if (!playerToken || !playerWalletToken) {
      res.status(400).json({ error: "playerWalletToken required" });
      return;
    }
    if (![10, 15, 25].includes(blockMinutes)) {
      res.status(400).json({ error: "blockMinutes must be 10, 15, or 25" });
      return;
    }

    const [session] = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.playerToken, playerToken));
    if (!session || session.status !== "active") {
      res.status(400).json({ error: "Session not active" });
      return;
    }
    if (!session.claimedByPlayerId || !session.blockMinutes) {
      res.status(400).json({ error: "Not a block session" });
      return;
    }

    const [player] = await db
      .select()
      .from(playersTable)
      .where(eq(playersTable.playerToken, playerWalletToken));
    if (!player || player.id !== session.claimedByPlayerId) {
      res.status(403).json({ error: "Wallet does not match session" });
      return;
    }

    const ratePerMinuteLzt = Math.round(Number(session.ratePerMinute) * 200);
    const addReserve = blockMinutes * ratePerMinuteLzt;
    const picked = pickPlayerBucket(
      session.paymentSource,
      addReserve,
      player.withdrawableBalanceLzt,
      player.internalBalanceLzt,
    );
    if (picked === null && addReserve > 0) {
      res.status(400).json({
        error: `Insufficient LZT — need ${addReserve} LZT for ${blockMinutes} min block`,
      });
      return;
    }

    const bucket = picked ?? "green";
    const playerCol =
      bucket === "green"
        ? playersTable.withdrawableBalanceLzt
        : playersTable.internalBalanceLzt;

    const updated = await db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(sessionsTable)
        .where(
          and(eq(sessionsTable.id, session.id), eq(sessionsTable.status, "active")),
        )
        .for("update");
      if (!locked || !locked.blockMinutes) {
        return null;
      }

      if (addReserve > 0) {
        const debited = await tx
          .update(playersTable)
          .set(
            bucket === "green"
              ? { withdrawableBalanceLzt: sql`${playersTable.withdrawableBalanceLzt} - ${addReserve}` }
              : { internalBalanceLzt: sql`${playersTable.internalBalanceLzt} - ${addReserve}` },
          )
          .where(
            and(
              eq(playersTable.id, player.id),
              sql`${playerCol} >= ${addReserve}`,
            ),
          )
          .returning({ id: playersTable.id });
        if (debited.length === 0) {
          return null;
        }
        await writeLedger(tx, [
          {
            groupId: randomUUID(),
            kind: "block_reserve",
            ownerType: "player",
            ownerId: player.id,
            bucket: bucket === "green" ? "cash" : "balance",
            deltaLzt: -addReserve,
            refType: "session",
            refId: locked.id,
            note: `block renew: +${blockMinutes} мин`,
          },
        ]);
      }

      const [row] = await tx
        .update(sessionsTable)
        .set({
          blockMinutes: (locked.blockMinutes ?? 0) + blockMinutes,
          blockReservedLzt: (locked.blockReservedLzt ?? 0) + addReserve,
        })
        .where(
          and(eq(sessionsTable.id, locked.id), eq(sessionsTable.status, "active")),
        )
        .returning();
      return row ?? null;
    });

    if (!updated) {
      res.status(400).json({ error: "Insufficient balance to renew block" });
      return;
    }

    sendSignalingMessage(session.id, {
      type: "block-renewed",
      blockMinutes: updated.blockMinutes,
      addedMinutes: blockMinutes,
    });

    res.json(ClaimSessionResponse.parse(serialize(updated)));
  },
);

router.post("/sessions/:id/rate", claimLimiter, async (req, res): Promise<void> => {
  const sessionId = String(req.params.id ?? "").trim();
  const playerWalletToken = String(req.body?.playerWalletToken ?? "").trim();
  const score = Number(req.body?.score);
  const comment = typeof req.body?.comment === "string" ? req.body.comment : "";

  if (!sessionId || !playerWalletToken) {
    res.status(400).json({ error: "playerWalletToken required" });
    return;
  }

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, sessionId));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  if (session.status !== "ended") {
    res.status(400).json({ error: "Session must be ended before rating" });
    return;
  }

  const [player] = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.playerToken, playerWalletToken));
  if (!player || player.id !== session.claimedByPlayerId) {
    res.status(403).json({ error: "Only the session player can rate" });
    return;
  }

  const result = await submitSessionRating({
    sessionId: session.id,
    playerId: player.id,
    hostId: session.hostId,
    score,
    comment,
  });
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.json({
    ratingAvg: result.ratingAvg,
    ratingCount: result.ratingCount,
  });
});

const SessionMetricSample = z.object({
  role: z.enum(["player", "host"]),
  sampledAt: z.string().datetime().optional(),
  rttMs: z.number().int().optional(),
  bitrateKbps: z.number().int().optional(),
  fps: z.number().int().optional(),
  packetLossPct: z.number().optional(),
  framesDropped: z.number().int().optional(),
  iceCandidateType: z.string().optional(),
  jitterMs: z.number().int().optional(),
});

const PostSessionMetricsBody = z.object({
  samples: z.array(SessionMetricSample).min(1).max(50),
});

router.post("/sessions/:id/metrics", async (req, res): Promise<void> => {
  const sessionId = (req.params.id ?? "").trim();
  if (!sessionId) {
    res.status(400).json({ error: "session id required" });
    return;
  }

  const parsed = PostSessionMetricsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : undefined;
  const hostToken =
    bearerToken ??
    (req.query.hostToken as string | undefined) ??
    (req.body?.hostToken as string | undefined);
  const playerToken =
    (req.headers["x-player-token"] as string | undefined) ??
    (req.body?.playerToken as string | undefined);

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, sessionId));

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  let authorized = false;
  if (hostToken) {
    const [host] = await db
      .select({ id: hostsTable.id })
      .from(hostsTable)
      .where(eq(hostsTable.hostToken, hostToken));
    authorized = host?.id === session.hostId;
  } else if (playerToken) {
    authorized = session.playerToken === playerToken;
  }
  if (!authorized) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const rows = parsed.data.samples.map((s) => ({
    sessionId,
    role: s.role,
    sampledAt: s.sampledAt ? new Date(s.sampledAt) : new Date(),
    rttMs: s.rttMs ?? null,
    bitrateKbps: s.bitrateKbps ?? null,
    fps: s.fps ?? null,
    packetLossPct: s.packetLossPct != null ? Math.round(s.packetLossPct) : null,
    framesDropped: s.framesDropped ?? null,
    iceCandidateType: s.iceCandidateType ?? null,
    jitterMs: s.jitterMs ?? null,
  }));

  await db.insert(sessionMetricsTable).values(rows);
  res.status(201).json({ inserted: rows.length });
});

export default router;
