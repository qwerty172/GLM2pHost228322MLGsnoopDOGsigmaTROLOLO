import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { eq, and, ne } from "drizzle-orm";
import {
  db,
  devKeysTable,
  gamesTable,
  hostsTable,
  hostGamesTable,
  sessionsTable,
} from "@workspace/db";
import { generateToken } from "../lib/tokens";
import { isHostAvailableNow } from "../lib/schedule";
import type { DevKeyHostRules } from "@workspace/db/schema";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// POST /embed/sessions — used by the third-party <iframe> widget.
//
// Unlike the normal player flow (POST /sessions + claim), the embed flow:
//   - picks the host itself, applying the dev key's hostRulesJson filters
//     (max price-per-minute, required tags) instead of requiring a hostToken
//   - charges the DEV KEY's own LZT balance (via billingWorker's devKeyId
//     branch), never the end player — the player never authenticates at all
//   - skips the "claim" step entirely: sessions.claimedByPlayerId stays null
//     forever on embed sessions, sessions.devKeyId is set instead
// ---------------------------------------------------------------------------

const CreateEmbedSessionBody = z.object({
  apiKey: z.string().min(1),
  gameSlug: z.string().min(1),
  resolution: z.string().optional(),
  bitrateKbps: z.number().int().positive().optional(),
});

router.post("/embed/sessions", async (req, res): Promise<void> => {
  const parsed = CreateEmbedSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { apiKey, gameSlug, resolution, bitrateKbps } = parsed.data;

  const [devKey] = await db
    .select()
    .from(devKeysTable)
    .where(eq(devKeysTable.apiKey, apiKey));
  if (!devKey) {
    res.status(403).json({ error: "invalid_api_key", message: "Unknown or invalid API key" });
    return;
  }
  if (devKey.status !== "active") {
    res.status(403).json({ error: "key_disabled", message: "This API key has been disabled" });
    return;
  }

  const [game] = await db
    .select()
    .from(gamesTable)
    .where(eq(gamesTable.slug, gameSlug));
  if (!game) {
    res.status(404).json({ error: "game_not_found", message: `No game with slug "${gameSlug}"` });
    return;
  }

  // Candidate hosts: enabled library entries for this game, joined with the
  // host row so we can apply schedule + rule filters.
  const candidates = await db
    .select({ entry: hostGamesTable, host: hostsTable })
    .from(hostGamesTable)
    .innerJoin(hostsTable, eq(hostGamesTable.hostId, hostsTable.id))
    .where(and(eq(hostGamesTable.gameId, game.id), eq(hostGamesTable.enabled, true)));

  const rules: DevKeyHostRules = devKey.hostRulesJson ?? {};

  const eligible = candidates.filter(({ entry, host }) => {
    if (
      typeof rules.maxPricePerMinuteLzt === "number" &&
      entry.pricePerMinuteLzt > rules.maxPricePerMinuteLzt
    ) {
      return false;
    }
    if (rules.tags && rules.tags.length > 0) {
      const hostTags = new Set(host.tags ?? []);
      if (!rules.tags.every((t) => hostTags.has(t))) return false;
    }
    if (!isHostAvailableNow(host.scheduleMode, host.scheduleJson ?? [], new Date())) {
      return false;
    }
    return true;
  });

  if (eligible.length === 0) {
    res.status(404).json({
      error: "no_eligible_host",
      message:
        "No host currently matches this game and the key's host-selection rules (price/tags/availability)",
    });
    return;
  }

  // Cheapest eligible host first; skip any that are already busy running
  // another session (checked one at a time, since "busy" can change between
  // the query above and now).
  eligible.sort((a, b) => a.entry.pricePerMinuteLzt - b.entry.pricePerMinuteLzt);

  for (const { entry, host } of eligible) {
    const [busy] = await db
      .select({ id: sessionsTable.id })
      .from(sessionsTable)
      .where(and(eq(sessionsTable.hostId, host.id), ne(sessionsTable.status, "ended")))
      .limit(1);
    if (busy) continue;

    const ratePerMinuteLzt = entry.pricePerMinuteLzt;
    const balanceLzt = devKey.internalBalanceLzt + devKey.withdrawableBalanceLzt;
    if (ratePerMinuteLzt > 0 && balanceLzt < ratePerMinuteLzt) {
      res.status(402).json({
        error: "key_balance_exhausted",
        message: `API key balance (${balanceLzt} LZT) is below the cost of one minute (${ratePerMinuteLzt} LZT) on this host. Top up the key's wallet to continue.`,
        balanceLzt,
        requiredLzt: ratePerMinuteLzt,
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
        appName: game.title,
        resolution: resolution ?? "1920x1080",
        bitrateKbps: bitrateKbps ?? 6000,
        ratePerMinute: String(ratePerMinuteLzt / 200),
        paymentSource: "auto",
        devKeyId: devKey.id,
      })
      .returning();
    if (!session) {
      res.status(500).json({ error: "internal_error", message: "Failed to create session" });
      return;
    }

    req.log.info(
      { sessionId: session.id, devKeyId: devKey.id, hostId: host.id, gameSlug },
      "Embed session created (dev-key funded)",
    );

    res.status(201).json({
      sessionId: session.id,
      playerToken,
      gameSlug: game.slug,
      gameTitle: game.title,
      hostDisplayName: host.displayName,
      ratePerMinuteLzt,
      keyBalanceLzt: balanceLzt,
    });
    return;
  }

  res.status(409).json({
    error: "hosts_busy",
    message: "All eligible hosts for this game are currently busy — try again shortly",
  });
});

export default router;
