// Central auth resolution and Express middleware for host/player/JWT dual-mode.

import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, hostsTable, playersTable } from "@workspace/db";
import {
  verifyAccessJwt,
  type UserType,
} from "./jwt";
import { headerUserToken } from "./requestToken";
import { requireHost as resolveHost, hostTokenFromRequest } from "./hostAuth";

export type AuthMode = "jwt" | "legacy";

export interface AuthUser {
  userId: string;
  userType: UserType;
  mode: AuthMode;
}

export interface HostAuth {
  host: typeof hostsTable.$inferSelect;
}

export interface PlayerAuth {
  player: typeof playersTable.$inferSelect;
}

export type AuthenticatedRequest = Request & {
  authUser?: AuthUser;
  authHost?: typeof hostsTable.$inferSelect;
  authPlayer?: typeof playersTable.$inferSelect;
};

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

/** Dual-mode: verify Bearer JWT or fall back to legacy opaque token header. */
export async function resolveAuthUser(
  req: Request,
): Promise<AuthUser | null> {
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
  const legacy =
    headerUserToken(req) ??
    hostTokenFromRequest(req) ??
    (req.query.hostToken as string | undefined);
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
      (req as AuthenticatedRequest).authUser = user;
      next();
    });
  };
}

export function requireHostMiddleware(): (
  req: Request,
  res: Response,
  next: NextFunction,
) => void {
  return (req, res, next) => {
    void resolveHost(req).then((auth) => {
      if (!auth.ok) {
        res.status(auth.status).json({ error: auth.error });
        return;
      }
      (req as AuthenticatedRequest).authHost = auth.host;
      next();
    });
  };
}

export function requirePlayerMiddleware(): (
  req: Request,
  res: Response,
  next: NextFunction,
) => void {
  return (req, res, next) => {
    const walletTokRaw =
      req.headers["x-player-wallet-token"] ?? req.headers["x-player-token"];
    const walletTok = Array.isArray(walletTokRaw) ? walletTokRaw[0] : walletTokRaw;
    if (!walletTok?.trim()) {
      res.status(401).json({ error: "X-Player-Wallet-Token required" });
      return;
    }
    void db
      .select()
      .from(playersTable)
      .where(eq(playersTable.playerToken, walletTok.trim()))
      .then(([player]) => {
        if (!player) {
          res.status(401).json({ error: "Invalid player wallet token" });
          return;
        }
        (req as AuthenticatedRequest).authPlayer = player;
        next();
      });
  };
}
