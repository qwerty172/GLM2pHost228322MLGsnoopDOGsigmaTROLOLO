import type { Request, Response } from "express";
import type { ObjectAclPolicy } from "./objectAcl";
import { getObjectAclPolicy } from "./objectAcl";
import {
  ObjectNotFoundError,
  ObjectStorageNotConfiguredError,
  ObjectStorageService,
} from "./objectStorage";
import { hostTokenFromRequest } from "./requestToken";
import { isCoverUploadObjectPath } from "./storageObjectPath";

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

/** Normalize `/api/storage/objects/…` or `/objects/…` to `/objects/…`. */
export function toObjectEntityPath(coverOrStorageUrl: string): string | null {
  const trimmed = coverOrStorageUrl.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/objects/")) return trimmed;
  const apiPrefix = "/api/storage/objects/";
  const idx = trimmed.indexOf(apiPrefix);
  if (idx >= 0) {
    return `/objects/${trimmed.slice(idx + apiPrefix.length)}`;
  }
  return null;
}

/** Best-effort ACL write for a storage-backed object path. */
export async function tryApplyObjectAcl(
  coverOrStorageUrl: string,
  aclPolicy: ObjectAclPolicy,
  req?: Request,
): Promise<void> {
  const entityPath = toObjectEntityPath(coverOrStorageUrl);
  if (!entityPath) return;
  try {
    const storage = new ObjectStorageService();
    await storage.trySetObjectEntityAclPolicy(entityPath, aclPolicy);
  } catch (err) {
    req?.log?.warn({ err, entityPath }, "Failed to set object ACL");
  }
}

/**
 * Set public ACL on a cover upload path only.
 * Rejects non-upload namespaces and objects owned by another principal.
 */
export async function tryApplyPublicCoverAcl(
  coverOrStorageUrl: string,
  hostId: string,
  req?: Request,
): Promise<void> {
  const entityPath = toObjectEntityPath(coverOrStorageUrl);
  if (!entityPath) return;
  if (!isCoverUploadObjectPath(entityPath)) {
    req?.log?.warn({ entityPath }, "Rejected public cover ACL on non-upload path");
    return;
  }

  const owner = `host:${hostId}`;
  try {
    const storage = new ObjectStorageService();
    const objectFile = await storage.getObjectEntityFile(entityPath);
    const existing = await getObjectAclPolicy(objectFile);
    if (existing?.owner && existing.owner !== owner) {
      req?.log?.warn(
        { entityPath, existingOwner: existing.owner },
        "Rejected public cover ACL overwrite",
      );
      return;
    }
    await storage.trySetObjectEntityAclPolicy(entityPath, {
      owner,
      visibility: "public",
    });
  } catch (err) {
    req?.log?.warn({ err, entityPath }, "Failed to set public cover ACL");
  }
}
