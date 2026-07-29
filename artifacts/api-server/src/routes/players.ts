import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, playersTable, hostsTable, sessionsTable } from "@workspace/db";
import {
  RegisterPlayerBody,
  GetPlayerResponse,
  GetPlayerParams,
} from "@workspace/api-zod";
import { generateToken } from "../lib/tokens";
import { ensureDepositAddressesForOwner } from "../lib/walletOwner";
import { rateLimit, ipKey } from "../lib/rateLimit";
import { headerUserToken } from "../lib/requestToken";

const router: IRouter = Router();

// Registration creates DB rows and (for full accounts) burns deposit
// addresses from the pool — cap per client IP.
const registerLimiter = rateLimit({
  scope: "players:register",
  windowMs: 60 * 60_000,
  max: 20,
  keyFn: ipKey,
});
// Player lookups by token: IP-keyed to block token brute-force.
const playerReadLimiter = rateLimit({ // keyed by token (default) — isolated per player
  scope: "players:read",
  windowMs: 60_000,
  max: 120, // keyed by token (default) — isolated per player
});

const claimGuestLimiter = rateLimit({
  scope: "players:claim-guest",
  windowMs: 60 * 60_000,
  max: 10,
  keyFn: ipKey,
});

const GUEST_CREDIT_LIMIT_LZT = 500;
const DEFAULT_CREDIT_LIMIT_LZT = 3000;

function serialize(p: typeof playersTable.$inferSelect) {
  return {
    id: p.id,
    playerToken: p.playerToken,
    displayName: p.displayName,
    internalBalanceLzt: p.internalBalanceLzt,
    withdrawableBalanceLzt: p.withdrawableBalanceLzt,
    isGuest: p.isGuest,
    createdAt: p.createdAt,
    lastSeenAt: p.lastSeenAt,
  };
}

router.post("/players/register", registerLimiter, async (req, res): Promise<void> => {
  const isGuestRequest = !!(req.body?.guest);

  if (isGuestRequest) {
    const playerToken = generateToken();
    const guestName = `Гость_${playerToken.slice(0, 6)}`;
    const [player] = await db
      .insert(playersTable)
      .values({
        playerToken,
        displayName: guestName,
        isGuest: true,
        creditLimitLzt: GUEST_CREDIT_LIMIT_LZT,
      })
      .returning();

    if (!player) {
      res.status(500).json({ error: "Failed to create guest player" });
      return;
    }

    req.log.info({ playerId: player.id, isGuest: true }, "Guest player registered");
    res.status(201).json(serialize(player));
    return;
  }

  const parsed = RegisterPlayerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const displayName = parsed.data.displayName?.trim();
  if (!displayName) {
    res.status(400).json({ error: "displayName required" });
    return;
  }

  const playerToken = generateToken();
  const [player] = await db
    .insert(playersTable)
    .values({
      playerToken,
      displayName,
    })
    .returning();

  if (!player) {
    res.status(500).json({ error: "Failed to create player" });
    return;
  }

  await ensureDepositAddressesForOwner("player", player.id);

  req.log.info({ playerId: player.id }, "Player registered");
  res.status(201).json(GetPlayerResponse.parse(serialize(player)));
});

router.get("/players/:playerToken", playerReadLimiter, async (req, res): Promise<void> => {
  const params = GetPlayerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [player] = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.playerToken, params.data.playerToken));

  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  res.json(GetPlayerResponse.parse(serialize(player)));
});

// POST /players/claim-guest
// Called by the desktop agent when a host registers: transfers guest balance +
// session history to the host account, then deactivates the guest token.
router.post("/players/claim-guest", claimGuestLimiter, async (req, res): Promise<void> => {
  const guestToken = (req.body?.guestToken as string | undefined)?.trim() ?? "";
  const hostToken = (req.body?.hostToken as string | undefined)?.trim() ?? "";

  if (!guestToken || !hostToken) {
    res.status(400).json({ error: "guestToken and hostToken are required" });
    return;
  }

  // Validate host token.
  const [host] = await db
    .select()
    .from(hostsTable)
    .where(eq(hostsTable.hostToken, hostToken));

  if (!host) {
    res.status(401).json({ error: "Invalid hostToken" });
    return;
  }

  // Find the guest player.
  const [guest] = await db
    .select()
    .from(playersTable)
    .where(
      and(
        eq(playersTable.playerToken, guestToken),
        eq(playersTable.isGuest, true),
      ),
    );

  if (!guest) {
    res.status(404).json({ error: "Guest player not found or token is not a guest" });
    return;
  }

  // Find or create a full player account linked to the host.
  // For now we create a new full player that inherits the guest balance.
  const newToken = generateToken();
  const [fullPlayer] = await db
    .insert(playersTable)
    .values({
      playerToken: newToken,
      displayName: host.displayName,
      isGuest: false,
      creditLimitLzt: DEFAULT_CREDIT_LIMIT_LZT,
      internalBalanceLzt: guest.internalBalanceLzt,
      withdrawableBalanceLzt: guest.withdrawableBalanceLzt,
    })
    .returning();

  if (!fullPlayer) {
    res.status(500).json({ error: "Failed to create full player account" });
    return;
  }

  // Transfer session history: reassign sessions claimed by the guest player to
  // the new full player account so the host can see complete session history.
  await db
    .update(sessionsTable)
    .set({ claimedByPlayerId: fullPlayer.id })
    .where(eq(sessionsTable.claimedByPlayerId, guest.id));

  // Deactivate the guest player by zeroing out their balance and marking inactive
  // via renaming the token so it can no longer be used.
  await db
    .update(playersTable)
    .set({
      internalBalanceLzt: 0,
      withdrawableBalanceLzt: 0,
      displayName: `[claimed] ${guest.displayName}`,
      playerToken: `__claimed_${guest.playerToken}`,
    })
    .where(eq(playersTable.id, guest.id));

  await ensureDepositAddressesForOwner("player", fullPlayer.id);

  req.log.info(
    { guestId: guest.id, fullPlayerId: fullPlayer.id, hostId: host.id },
    "Guest account claimed by host",
  );

  res.status(200).json({
    playerToken: fullPlayer.playerToken,
    transferredInternalLzt: guest.internalBalanceLzt,
    transferredWithdrawableLzt: guest.withdrawableBalanceLzt,
  });
});

const upgradeGuestLimiter = rateLimit({
  scope: "players:upgrade-guest",
  windowMs: 60 * 60_000,
  max: 10,
  keyFn: ipKey,
});

router.post("/players/upgrade-guest", upgradeGuestLimiter, async (req, res): Promise<void> => {
  const guestToken = String(req.body?.guestToken ?? "").trim();
  const displayName = String(req.body?.displayName ?? "").trim();
  if (!guestToken) {
    res.status(400).json({ error: "guestToken required" });
    return;
  }
  if (displayName.length < 2 || displayName.length > 32) {
    res.status(400).json({ error: "displayName must be 2–32 characters" });
    return;
  }

  const [guest] = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.playerToken, guestToken));
  if (!guest) {
    res.status(404).json({ error: "Guest not found" });
    return;
  }
  if (!guest.isGuest) {
    res.status(400).json({ error: "Account is not a guest" });
    return;
  }

  const newToken = generateToken();
  const [upgraded] = await db
    .update(playersTable)
    .set({
      playerToken: newToken,
      displayName,
      isGuest: false,
      creditLimitLzt: DEFAULT_CREDIT_LIMIT_LZT,
    })
    .where(and(eq(playersTable.id, guest.id), eq(playersTable.isGuest, true)))
    .returning();

  if (!upgraded) {
    res.status(500).json({ error: "Upgrade failed" });
    return;
  }

  await ensureDepositAddressesForOwner("player", upgraded.id);

  req.log.info({ playerId: upgraded.id }, "Guest upgraded to full account");
  res.status(200).json(serialize(upgraded));
});

const creditSettingsLimiter = rateLimit({
  scope: "players:credit-settings",
  windowMs: 60_000,
  max: 30,
  keyFn: ipKey,
});

router.patch(
  "/players/me/credit-settings",
  creditSettingsLimiter,
  async (req, res): Promise<void> => {
    const token = headerUserToken(req);
    if (!token) {
      res.status(401).json({ error: "X-User-Token required" });
      return;
    }
    const creditEnabled = req.body?.creditEnabled;
    if (typeof creditEnabled !== "boolean") {
      res.status(400).json({ error: "creditEnabled boolean required" });
      return;
    }

    const [player] = await db
      .select()
      .from(playersTable)
      .where(eq(playersTable.playerToken, token));
    if (!player) {
      res.status(404).json({ error: "Player not found" });
      return;
    }

    const creditLimitLzt = creditEnabled ? DEFAULT_CREDIT_LIMIT_LZT : 0;
    const [updated] = await db
      .update(playersTable)
      .set({ creditLimitLzt })
      .where(eq(playersTable.id, player.id))
      .returning();

    if (!updated) {
      res.status(500).json({ error: "Update failed" });
      return;
    }

    res.json({
      creditLimitLzt: updated.creditLimitLzt,
      creditEnabled: updated.creditLimitLzt > 0,
    });
  },
);

export default router;
