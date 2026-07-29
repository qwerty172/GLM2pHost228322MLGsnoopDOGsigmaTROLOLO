import type { Request, Response } from "express";
import {
  ObjectNotFoundError,
  ObjectStorageNotConfiguredError,
} from "./objectStorage";
import { hostTokenFromRequest } from "./requestToken";

export function respondStorageUnavailable(res: Response): void {
  res.status(503).json({
    error: "storage_unavailable",
    message: "Хранилище объектов не настроено в этой среде",
  });
}

export function handleStorageError(
  req: Request,
  res: Response,
  error: unknown,
  fallbackMessage: string,
): void {
  if (error instanceof ObjectStorageNotConfiguredError) {
    respondStorageUnavailable(res);
    return;
  }
  if (error instanceof ObjectNotFoundError) {
    req.log.warn({ err: error }, "Object not found");
    res.status(404).json({ error: "Object not found" });
    return;
  }
  req.log.error({ err: error }, fallbackMessage);
  res.status(500).json({ error: fallbackMessage });
}

export async function resolveHostIdFromRequest(
  req: Request,
): Promise<string | null> {
  const hostTok = hostTokenFromRequest(req);
  if (!hostTok) return null;
  const { db, hostsTable } = await import("@workspace/db");
  const { eq } = await import("drizzle-orm");
  const [host] = await db
    .select({ id: hostsTable.id })
    .from(hostsTable)
    .where(eq(hostsTable.hostToken, hostTok));
  return host?.id ?? null;
}

export async function resolvePlayerIdFromRequest(
  req: Request,
): Promise<string | null> {
  const playerTokRaw =
    req.headers["x-player-wallet-token"] ?? req.headers["x-player-token"];
  const playerTok = Array.isArray(playerTokRaw) ? playerTokRaw[0] : playerTokRaw;
  if (!playerTok) return null;
  const { db, playersTable } = await import("@workspace/db");
  const { eq } = await import("drizzle-orm");
  const [player] = await db
    .select({ id: playersTable.id })
    .from(playersTable)
    .where(eq(playersTable.playerToken, playerTok));
  return player?.id ?? null;
}

export async function resolveCallerUserId(req: Request): Promise<string | undefined> {
  const hostId = await resolveHostIdFromRequest(req);
  if (hostId) return `host:${hostId}`;
  const playerId = await resolvePlayerIdFromRequest(req);
  if (playerId) return `player:${playerId}`;
  return undefined;
}

/** Cover uploads issued via POST /storage/uploads/request-url (legacy: no ACL metadata). */
const LEGACY_PUBLIC_OBJECT_PREFIX = "/objects/uploads/";

export function normalizeStorageObjectPath(objectPath: string): string {
  const trimmed = objectPath.trim();
  if (trimmed.startsWith("/api/storage")) {
    return trimmed.slice("/api/storage".length);
  }
  return trimmed;
}

export function isLegacyPublicObjectPath(objectPath: string): boolean {
  const normalized = normalizeStorageObjectPath(objectPath);
  return normalized.startsWith(LEGACY_PUBLIC_OBJECT_PREFIX);
}
