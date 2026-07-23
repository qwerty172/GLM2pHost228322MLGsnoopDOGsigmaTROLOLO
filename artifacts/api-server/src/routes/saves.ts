import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  gamesTable,
  playersTable,
  playerGameSavesTable,
} from "@workspace/db";
import { ObjectStorageService } from "../lib/objectStorage";
import { randomUUID } from "node:crypto";

const router: IRouter = Router();
const storage = new ObjectStorageService();

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
    downloadUrl = await storage.getObjectDownloadURL(save.storageKey);
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

const UploadUrlBody = z.object({
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
    const parsed = UploadUrlBody.safeParse(req.body);
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

    if (existing) {
      const [updated] = await db
        .update(playerGameSavesTable)
        .set({
          storageKey: parsed.data.storageKey,
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
        sizeBytes: parsed.data.sizeBytes,
        version,
      })
      .returning();
    res.status(201).json({ ok: true, save: created });
  },
);

export default router;
