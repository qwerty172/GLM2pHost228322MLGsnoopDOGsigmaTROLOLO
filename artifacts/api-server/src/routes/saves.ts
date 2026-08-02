import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod/v4";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  hostsTable,
  sessionsTable,
  gamesTable,
  playersTable,
  playerGameSavesTable,
} from "@workspace/db";
import {
  ObjectStorageService,
  ObjectStorageNotConfiguredError,
} from "../lib/objectStorage";
import {
  handleStorageError,
  respondStorageUnavailable,
  resolveHostIdFromRequest,
  resolvePlayerIdFromRequest,
} from "../lib/storageRouteHelpers";
import { trySetSavePrivateAcl } from "../lib/storageAclHelpers";
import { randomUUID } from "node:crypto";

const MAX_SAVE_SIZE_BYTES = 500 * 1024 * 1024;

const DownloadQuery = z.object({
  sessionId: z.string().uuid(),
});

const UploadUrlBody = z.object({
  sessionId: z.string().uuid(),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(MAX_SAVE_SIZE_BYTES, "Save archive must be ≤ 500 MB"),
});

const ConfirmBody = z.object({
  sessionId: z.string().uuid(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/i, "Expected sha256 hex hash"),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(MAX_SAVE_SIZE_BYTES, "Save archive must be ≤ 500 MB"),
});

const DownloadUrlResponse = z.object({
  downloadURL: z.string(),
  objectPath: z.string(),
});

const UploadUrlResponse = z.object({
  uploadURL: z.string(),
  objectPath: z.string(),
});

const ConfirmResponse = z.object({
  saved: z.boolean(),
  objectPath: z.string(),
});

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();
const storage = objectStorageService;

async function resolveHostSession(req: Request, sessionId: string) {
  const hostId = await resolveHostIdFromRequest(req);
  if (!hostId) {
    return { ok: false as const, status: 401, message: "Missing X-Host-Token header" };
  }

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, sessionId));
  if (!session) {
    return { ok: false as const, status: 404, message: "Session not found" };
  }
  if (session.hostId !== hostId) {
    return { ok: false as const, status: 403, message: "Not your session" };
  }
  if (!session.claimedByPlayerId) {
    return { ok: false as const, status: 409, message: "Session has no claimed player" };
  }
  if (session.isTest) {
    return { ok: false as const, status: 409, message: "Test sessions skip save sync" };
  }

  return {
    ok: true as const,
    session: {
      ...session,
      playerId: session.claimedByPlayerId,
    },
  };
}

/**
 * GET /saves/download-url?sessionId=
 *
 * Returns a presigned GET URL for the player's cloud save archive.
 * 404 when no save exists for this player/game pair.
 */
router.get("/saves/download-url", async (req: Request, res: Response) => {
  const parsed = DownloadQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const resolved = await resolveHostSession(req, parsed.data.sessionId);
  if (!resolved.ok) {
    res.status(resolved.status).json({ error: resolved.message });
    return;
  }

  const { playerId, gameId } = resolved.session;

  try {
    const file = await objectStorageService.getSaveFile(playerId, gameId);
    if (!file) {
      res.status(404).json({ error: "save_not_found" });
      return;
    }

    const downloadURL = await objectStorageService.getSaveDownloadURL(
      playerId,
      gameId,
    );
    const objectPath = objectStorageService.getSaveObjectPath(playerId, gameId);
    res.json(
      DownloadUrlResponse.parse({
        downloadURL,
        objectPath,
      }),
    );
  } catch (error) {
    handleStorageError(req, res, error, "Failed to generate download URL");
  }
});

/**
 * POST /saves/upload-url
 *
 * Request a presigned PUT URL for uploading a save archive.
 */
router.post("/saves/upload-url", async (req: Request, res: Response) => {
  const parsed = UploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const resolved = await resolveHostSession(req, parsed.data.sessionId);
  if (!resolved.ok) {
    res.status(resolved.status).json({ error: resolved.message });
    return;
  }

  const { playerId, gameId } = resolved.session;

  try {
    const uploadURL = await objectStorageService.getSaveUploadURL(
      playerId,
      gameId,
    );
    const objectPath = objectStorageService.getSaveObjectPath(playerId, gameId);
    res.json(
      UploadUrlResponse.parse({
        uploadURL,
        objectPath,
      }),
    );
  } catch (error) {
    handleStorageError(req, res, error, "Failed to generate upload URL");
  }
});

/**
 * POST /saves/confirm
 *
 * Upsert player_game_saves metadata after a successful PUT upload.
 */
router.post("/saves/confirm", async (req: Request, res: Response) => {
  const parsed = ConfirmBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const resolved = await resolveHostSession(req, parsed.data.sessionId);
  if (!resolved.ok) {
    res.status(resolved.status).json({ error: resolved.message });
    return;
  }

  const { playerId, gameId } = resolved.session;
  const objectPath = objectStorageService.getSaveObjectPath(playerId, gameId);
  const storageKey = `saves/${playerId}/${gameId}/save.zip`;

  try {
    const file = await objectStorageService.getSaveFile(playerId, gameId);
    if (!file) {
      res.status(404).json({ error: "save_upload_not_found" });
      return;
    }

    try {
      await trySetSavePrivateAcl(objectPath, playerId);
    } catch (aclErr) {
      req.log.warn({ err: aclErr }, "Failed to set save ACL (metadata still saved)");
    }

    const now = new Date();
    await db
      .insert(playerGameSavesTable)
      .values({
        playerId,
        gameId,
        objectPath,
        storageKey,
        sizeBytes: parsed.data.sizeBytes,
        contentHash: parsed.data.contentHash.toLowerCase(),
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          playerGameSavesTable.playerId,
          playerGameSavesTable.gameId,
        ],
        set: {
          objectPath,
          storageKey,
          sizeBytes: parsed.data.sizeBytes,
          contentHash: parsed.data.contentHash.toLowerCase(),
          updatedAt: now,
        },
      });

    res.json(ConfirmResponse.parse({ saved: true, objectPath }));
  } catch (error) {
    handleStorageError(req, res, error, "Failed to confirm save upload");
  }
});


async function resolvePlayer(req: {
  headers: Record<string, string | string[] | undefined>;
}): Promise<{ id: string } | null> {
  const token = req.headers["x-player-wallet-token"] as string | undefined;
  if (!token) return null;
  const [player] = await db
    .select({ id: playersTable.id })
    .from(playersTable)
    .where(eq(playersTable.playerToken, token));
  return player ?? null;
}

/** GET /players/me/saves/:gameId — latest save metadata + download URL */
router.get("/players/me/saves/:gameId", async (req, res): Promise<void> => {
  const player = await resolvePlayer(req);
  if (!player) {
    res.status(401).json({ error: "Missing X-Player-Wallet-Token" });
    return;
  }
  const gameId = String(req.params.gameId ?? "");
  if (!gameId) {
    res.status(400).json({ error: "gameId required" });
    return;
  }

  const [save] = await db
    .select()
    .from(playerGameSavesTable)
    .where(
      and(
        eq(playerGameSavesTable.playerId, player.id),
        eq(playerGameSavesTable.gameId, gameId),
      ),
    )
    .orderBy(desc(playerGameSavesTable.updatedAt))
    .limit(1);

  if (!save) {
    res.json({ save: null });
    return;
  }

  let downloadUrl: string | null = null;
  try {
    if (save.storageKey) {
      downloadUrl = await storage.getObjectDownloadURL(save.storageKey);
    } else {
      downloadUrl = await storage.getSaveDownloadURL(player.id, gameId);
    }
  } catch {
    downloadUrl = null;
  }

  res.json({
    save: {
      gameId: save.gameId,
      version: save.version,
      sizeBytes: save.sizeBytes,
      updatedAt: save.updatedAt.toISOString(),
      downloadUrl,
    },
  });
});

const PlayerSaveUploadUrlBody = z.object({
  sizeBytes: z.number().int().positive().max(512 * 1024 * 1024),
});

/** POST /players/me/saves/:gameId/upload-url — presigned PUT for save archive */
router.post(
  "/players/me/saves/:gameId/upload-url",
  async (req, res): Promise<void> => {
    const player = await resolvePlayer(req);
    if (!player) {
      res.status(401).json({ error: "Missing X-Player-Wallet-Token" });
      return;
    }
    const gameId = String(req.params.gameId ?? "");
    const parsed = PlayerSaveUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [game] = await db
      .select({ id: gamesTable.id, saveManifest: gamesTable.saveManifest })
      .from(gamesTable)
      .where(eq(gamesTable.id, gameId));
    if (!game) {
      res.status(404).json({ error: "Game not found" });
      return;
    }
    if (!game.saveManifest || game.saveManifest.length === 0) {
      res.status(400).json({ error: "Game has no cloud save manifest" });
      return;
    }

    const objectId = randomUUID();
    const storageKey = `saves/${player.id}/${gameId}/${objectId}.zip`;
    const uploadURL = await storage.getObjectUploadURLForKey(storageKey);

    res.json({
      uploadURL,
      storageKey,
      sizeBytes: parsed.data.sizeBytes,
    });
  },
);

const CommitBody = z.object({
  storageKey: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  version: z.number().int().positive().optional(),
});

/** POST /players/me/saves/:gameId/commit — finalize save after upload */
router.post(
  "/players/me/saves/:gameId/commit",
  async (req, res): Promise<void> => {
    const player = await resolvePlayer(req);
    if (!player) {
      res.status(401).json({ error: "Missing X-Player-Wallet-Token" });
      return;
    }
    const gameId = String(req.params.gameId ?? "");
    const parsed = CommitBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const expectedPrefix = `saves/${player.id}/${gameId}/`;
    if (!parsed.data.storageKey.startsWith(expectedPrefix)) {
      res.status(403).json({ error: "Invalid storageKey" });
      return;
    }

    const [existing] = await db
      .select()
      .from(playerGameSavesTable)
      .where(
        and(
          eq(playerGameSavesTable.playerId, player.id),
          eq(playerGameSavesTable.gameId, gameId),
        ),
      );

    const version = parsed.data.version ?? (existing ? existing.version + 1 : 1);
    const objectPath = `/objects/${parsed.data.storageKey}`;

    try {
      await trySetSavePrivateAcl(objectPath, player.id);
    } catch (aclErr) {
      req.log.warn({ err: aclErr }, "Failed to set save ACL (metadata still saved)");
    }

    if (existing) {
      const [updated] = await db
        .update(playerGameSavesTable)
        .set({
          storageKey: parsed.data.storageKey,
          objectPath: `/objects/${parsed.data.storageKey}`,
          sizeBytes: parsed.data.sizeBytes,
          version,
          updatedAt: new Date(),
        })
        .where(eq(playerGameSavesTable.id, existing.id))
        .returning();
      res.json({ ok: true, save: updated });
      return;
    }

    const [created] = await db
      .insert(playerGameSavesTable)
      .values({
        playerId: player.id,
        gameId,
        storageKey: parsed.data.storageKey,
        objectPath: `/objects/${parsed.data.storageKey}`,
        sizeBytes: parsed.data.sizeBytes,
        version,
        contentHash: "",
      })
      .returning();
    res.status(201).json({ ok: true, save: created });
  },
);


export default router;
