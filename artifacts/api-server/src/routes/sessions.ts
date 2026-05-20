import { Router, type IRouter } from "express";
import { eq, and, or, isNull } from "drizzle-orm";
import {
  db,
  gamesTable,
  hostsTable,
  playersTable,
  sessionsTable,
} from "@workspace/db";
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

  const playerToken = generateToken();
  // Host's configured per-minute price wins over any client-supplied value.
  // Negative rates are allowed (host-pays-player promo) and validated at the
  // host config endpoint, so we just clamp the per-tick amount used by the
  // billing worker against the configured cap.
  const ratePerMinute = Number(host.minutePriceUsd);
  if (!Number.isFinite(ratePerMinute) || Math.abs(ratePerMinute) > 100) {
    res.status(400).json({ error: "Host's minute price is invalid" });
    return;
  }
  const [session] = await db
    .insert(sessionsTable)
    .values({
      hostId: host.id,
      playerToken,
      appName: parsed.data.appName,
      resolution: parsed.data.resolution ?? "1920x1080",
      bitrateKbps: parsed.data.bitrateKbps ?? 6000,
      ratePerMinute: String(ratePerMinute),
      paymentSource: parsed.data.paymentSource ?? "auto",
    })
    .returning();

  if (!session) {
    res.status(500).json({ error: "Failed to create session" });
    return;
  }

  req.log.info({ sessionId: session.id }, "Session created");
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

    const [session] = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.playerToken, params.data.playerToken));

    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    res.json(GetSessionByPlayerTokenResponse.parse(serialize(session)));
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
    if (picked === null && minBalanceLzt > 0) {
      res.status(400).json({
        error: `Insufficient LZT — need at least ${minBalanceLzt} LZT in a single ${session.paymentSource === "auto" ? "(green or blue)" : session.paymentSource} bucket to start`,
      });
      return;
    }

    const [updated] = await db
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

  const [session] = await db
    .update(sessionsTable)
    .set({ status: "ended", endedAt: new Date() })
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
