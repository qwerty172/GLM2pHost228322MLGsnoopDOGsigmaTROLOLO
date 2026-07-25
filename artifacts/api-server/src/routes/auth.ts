import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, and, isNull, gt } from "drizzle-orm";
import { z } from "zod/v4";
import crypto from "node:crypto";
import {
  db,
  hostsTable,
  playersTable,
  refreshTokensTable,
  sessionsTable,
} from "@workspace/db";
import {
  generateRefreshToken,
  hashRefreshToken,
  signAccessJwt,
  signWsTicket,
  REFRESH_TTL_SEC,
  WS_TICKET_TTL_SEC,
  verifyAccessJwt,
  type UserType,
} from "../lib/jwt";
import { headerUserToken } from "../lib/requestToken";
import { requireHost } from "../lib/hostAuth";
import { rateLimit, ipKey } from "../lib/rateLimit";

const router: IRouter = Router();

const refreshLimiter = rateLimit({
  scope: "auth:refresh",
  windowMs: 60_000,
  max: 30,
  keyFn: ipKey,
});

const REFRESH_COOKIE = "dh_refresh";

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: REFRESH_TTL_SEC * 1000,
    path: "/api/auth",
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
}

async function resolveUserFromLegacyToken(
  token: string,
): Promise<{ userId: string; userType: UserType } | null> {
  const [host] = await db
    .select({ id: hostsTable.id })
    .from(hostsTable)
    .where(eq(hostsTable.hostToken, token));
  if (host) return { userId: host.id, userType: "host" };

  const [player] = await db
    .select({ id: playersTable.id })
    .from(playersTable)
    .where(eq(playersTable.playerToken, token));
  if (player) return { userId: player.id, userType: "player" };
  return null;
}

async function issueTokenPair(
  userId: string,
  userType: UserType,
  res: Response,
): Promise<{ accessToken: string }> {
  const accessToken = await signAccessJwt(userId, userType);
  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + REFRESH_TTL_SEC * 1000);
  await db.insert(refreshTokensTable).values({
    userId,
    userType,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt,
  });
  setRefreshCookie(res, refreshToken);
  return { accessToken };
}

const LoginBody = z.object({
  legacyToken: z.string().min(1),
});

router.post("/auth/login", refreshLimiter, async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!process.env["JWT_SECRET"]?.trim()) {
    res.status(503).json({ error: "JWT auth not configured" });
    return;
  }
  const user = await resolveUserFromLegacyToken(parsed.data.legacyToken);
  if (!user) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
  const pair = await issueTokenPair(user.userId, user.userType, res);
  res.json({ accessToken: pair.accessToken, expiresInSec: 15 * 60 });
});

router.post("/auth/refresh", refreshLimiter, async (req, res): Promise<void> => {
  if (!process.env["JWT_SECRET"]?.trim()) {
    res.status(503).json({ error: "JWT auth not configured" });
    return;
  }
  const raw =
    (req.cookies?.[REFRESH_COOKIE] as string | undefined) ??
    (req.body?.refreshToken as string | undefined);
  if (!raw) {
    res.status(401).json({ error: "Refresh token required" });
    return;
  }
  const tokenHash = hashRefreshToken(raw);
  const now = new Date();
  const [row] = await db
    .select()
    .from(refreshTokensTable)
    .where(
      and(
        eq(refreshTokensTable.tokenHash, tokenHash),
        isNull(refreshTokensTable.revokedAt),
        gt(refreshTokensTable.expiresAt, now),
      ),
    );
  if (!row) {
    res.status(401).json({ error: "Invalid refresh token" });
    return;
  }
  await db
    .update(refreshTokensTable)
    .set({ revokedAt: now })
    .where(eq(refreshTokensTable.id, row.id));
  const userType = row.userType as UserType;
  const pair = await issueTokenPair(row.userId, userType, res);
  res.json({ accessToken: pair.accessToken, expiresInSec: 15 * 60 });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const raw = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (raw) {
    const tokenHash = hashRefreshToken(raw);
    await db
      .update(refreshTokensTable)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokensTable.tokenHash, tokenHash));
  }
  clearRefreshCookie(res);
  res.json({ ok: true });
});

const WsTicketBody = z.object({
  role: z.enum(["host", "player"]),
  sessionId: z.string().uuid(),
});

router.post("/auth/ws-ticket", refreshLimiter, async (req, res): Promise<void> => {
  if (!process.env["JWT_SECRET"]?.trim()) {
    res.status(503).json({ error: "JWT auth not configured" });
    return;
  }
  const parsed = WsTicketBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let userId: string | null = null;
  if (parsed.data.role === "host") {
    const auth = await requireHost(req);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }
    userId = auth.host.id;
  } else {
    const walletTokRaw = req.headers["x-player-wallet-token"];
    const walletTok = Array.isArray(walletTokRaw) ? walletTokRaw[0] : walletTokRaw;
    if (!walletTok?.trim()) {
      res.status(401).json({ error: "X-Player-Wallet-Token required" });
      return;
    }
    const [player] = await db
      .select({ id: playersTable.id })
      .from(playersTable)
      .where(eq(playersTable.playerToken, walletTok.trim()));
    if (!player) {
      res.status(401).json({ error: "Invalid player wallet token" });
      return;
    }
    userId = player.id;
  }

  const [session] = await db
    .select({ id: sessionsTable.id, hostId: sessionsTable.hostId, claimedByPlayerId: sessionsTable.claimedByPlayerId })
    .from(sessionsTable)
    .where(eq(sessionsTable.id, parsed.data.sessionId));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  if (parsed.data.role === "host" && session.hostId !== userId) {
    res.status(403).json({ error: "Not your session" });
    return;
  }
  if (parsed.data.role === "player" && session.claimedByPlayerId !== userId) {
    res.status(403).json({ error: "Session not claimed by this player" });
    return;
  }

  const wsTicket = await signWsTicket(userId, parsed.data.role, parsed.data.sessionId);
  res.json({ wsTicket, expiresInSec: WS_TICKET_TTL_SEC });
});

/** Dual-mode: verify Bearer JWT or fall back to legacy opaque token header. */
export async function resolveAuthUser(
  req: Request,
): Promise<{ userId: string; userType: UserType; mode: "jwt" | "legacy" } | null> {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const jwt = authHeader.slice("Bearer ".length).trim();
    if (jwt.includes(".")) {
      const claims = await verifyAccessJwt(jwt);
      if (claims?.sub && claims.typ) {
        return { userId: claims.sub, userType: claims.typ, mode: "jwt" };
      }
    }
  }
  const legacy = headerUserToken(req) ?? (req.query.hostToken as string | undefined);
  if (legacy) {
    const user = await resolveUserFromLegacyToken(legacy);
    if (user) return { ...user, mode: "legacy" };
  }
  return null;
}

export function requireAuth(): (
  req: Request,
  res: Response,
  next: NextFunction,
) => void {
  return (req, res, next) => {
    void resolveAuthUser(req).then((user) => {
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      (req as Request & { authUser?: typeof user }).authUser = user;
      next();
    });
  };
}

export default router;
