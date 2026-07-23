import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod/v4";
import { eq } from "drizzle-orm";
import {
  db,
  hostsTable,
  sessionsTable,
  playerGameSavesTable,
} from "@workspace/db";
import {
  ObjectStorageService,
  ObjectStorageNotConfiguredError,
} from "../lib/objectStorage";

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

function respondStorageUnavailable(res: Response): void {
  res.status(503).json({
    error: "storage_unavailable",
    message: "Хранилище объектов не настроено в этой среде",
  });
}

function handleStorageError(
  req: Request,
  res: Response,
  error: unknown,
  fallbackMessage: string,
): void {
  if (error instanceof ObjectStorageNotConfiguredError) {
    respondStorageUnavailable(res);
    return;
  }
  req.log.error({ err: error }, fallbackMessage);
  res.status(500).json({ error: fallbackMessage });
}

async function resolveHostSession(req: Request, sessionId: string) {
  const token = req.headers["x-host-token"] as string | undefined;
  if (!token) {
    return { ok: false as const, status: 401, message: "Missing X-Host-Token header" };
  }

  const [host] = await db
    .select({ id: hostsTable.id })
    .from(hostsTable)
    .where(eq(hostsTable.hostToken, token));
  if (!host) {
    return { ok: false as const, status: 401, message: "Unknown host token" };
  }

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, sessionId));
  if (!session) {
    return { ok: false as const, status: 404, message: "Session not found" };
  }
  if (session.hostId !== host.id) {
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

  try {
    const file = await objectStorageService.getSaveFile(playerId, gameId);
    if (!file) {
      res.status(404).json({ error: "save_upload_not_found" });
      return;
    }

    const now = new Date();
    await db
      .insert(playerGameSavesTable)
      .values({
        playerId,
        gameId,
        objectPath,
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

export default router;
