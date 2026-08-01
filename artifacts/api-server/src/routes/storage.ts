import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import { z } from "zod/v4";
import { ObjectStorageService, ObjectNotFoundError, ObjectStorageNotConfiguredError } from "../lib/objectStorage";
import {
  handleStorageError,
  respondStorageUnavailable,
} from "../lib/storageRouteHelpers";
import { enforceObjectReadAccess } from "../lib/storageObjectAccess";
import multer from "multer";

const ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_COVER_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_CLIP_SIZE_BYTES = 200 * 1024 * 1024; // 200 MB

const clipUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CLIP_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype === "video/webm" || file.mimetype.startsWith("video/"));
  },
});

const RequestUploadUrlBody = z.object({
  name: z.string().min(1),
  size: z.number().int().positive().max(MAX_COVER_SIZE_BYTES, "File must be ≤ 2 MB"),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

const RequestUploadUrlResponse = z.object({
  uploadURL: z.string(),
  objectPath: z.string(),
  metadata: z.object({
    name: z.string(),
    size: z.number(),
    contentType: z.string(),
  }),
});

const ConfirmUploadBody = z.object({
  objectPath: z
    .string()
    .min(1)
    .refine(
      (p) => p.startsWith("/api/storage/objects/uploads/"),
      "objectPath must be a cover upload under /api/storage/objects/uploads/",
    ),
});

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 */
router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  // Require an authenticated host token for upload URL issuance.
  const token = req.headers["x-host-token"] as string | undefined;
  if (!token) {
    res.status(401).json({ error: "Missing X-Host-Token header" });
    return;
  }

  const { db, hostsTable } = await import("@workspace/db");
  const { eq } = await import("drizzle-orm");
  const [host] = await db
    .select({ id: hostsTable.id })
    .from(hostsTable)
    .where(eq(hostsTable.hostToken, token));
  if (!host) {
    res.status(401).json({ error: "Unknown host token" });
    return;
  }

  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const { name, size, contentType } = parsed.data;

    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    // Normalize to raw object path (/objects/...) then prefix with /api/storage
    // so the returned path is directly usable as a serving URL.
    const rawPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
    const objectPath = `/api/storage${rawPath}`;

    res.json(
      RequestUploadUrlResponse.parse({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      }),
    );
  } catch (error) {
    handleStorageError(req, res, error, "Failed to generate upload URL");
  }
});

/**
 * POST /storage/uploads/confirm
 *
 * After PUT to the presigned URL, attach a public-read ACL so covers are
 * served via GET /storage/objects/* (legacy objects without ACL are denied).
 */
router.post("/storage/uploads/confirm", async (req: Request, res: Response) => {
  const token = req.headers["x-host-token"] as string | undefined;
  if (!token) {
    res.status(401).json({ error: "Missing X-Host-Token header" });
    return;
  }

  const { db, hostsTable } = await import("@workspace/db");
  const { eq } = await import("drizzle-orm");
  const [host] = await db
    .select({ id: hostsTable.id })
    .from(hostsTable)
    .where(eq(hostsTable.hostToken, token));
  if (!host) {
    res.status(401).json({ error: "Unknown host token" });
    return;
  }

  const parsed = ConfirmUploadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const rawPath = parsed.data.objectPath.replace(/^\/api\/storage/, "");

  try {
    const normalized = await objectStorageService.trySetObjectEntityAclPolicy(rawPath, {
      owner: `host:${host.id}`,
      visibility: "public",
    });
    res.json({ objectPath: `/api/storage${normalized}` });
  } catch (error) {
    handleStorageError(req, res, error, "Failed to confirm upload");
  }
});

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    handleStorageError(req, res, error, "Failed to serve public object");
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR with ACL enforcement.
 * - visibility=public → anyone can READ
 * - visibility=private → owner only
 * - no ACL metadata → 403 (legacy public-read bypass removed)
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    const access = await enforceObjectReadAccess(req, objectFile, objectStorageService);
    if (!access.allowed) {
      res.status(access.status).json({
        error: access.status === 401 ? "Unauthorized" : "Forbidden",
      });
      return;
    }

    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    handleStorageError(req, res, error, "Failed to serve object");
  }
});

/**
 * POST /storage/clip-upload
 *
 * Authenticated players can upload WebM clip files.
 * Accepts multipart/form-data with a single "file" field.
 * Requires X-Player-Wallet-Token header matching a known wallet.
 */
router.post(
  "/storage/clip-upload",
  clipUpload.single("file"),
  async (req: Request, res: Response) => {
    const playerWalletToken = req.headers["x-player-wallet-token"] as string | undefined;
    if (!playerWalletToken) {
      res.status(401).json({ error: "Missing X-Player-Wallet-Token header" });
      return;
    }

    // Verify the player wallet token exists
    const { db, playersTable } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    const [player] = await db
      .select({ id: playersTable.id })
      .from(playersTable)
      .where(eq(playersTable.playerToken, playerWalletToken));
    if (!player) {
      res.status(401).json({ error: "Unknown player wallet token" });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const rawPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      // Upload the clip buffer to object storage
      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": req.file.mimetype },
        body: req.file.buffer,
      });

      if (!uploadRes.ok) {
        req.log.error({ status: uploadRes.status }, "Object storage PUT failed");
        res.status(502).json({ error: "Failed to store clip" });
        return;
      }

      try {
        await objectStorageService.trySetObjectEntityAclPolicy(rawPath, {
          owner: `player:${player.id}`,
          visibility: "private",
        });
      } catch (aclErr) {
        req.log.warn({ err: aclErr }, "Failed to set clip ACL (object still stored)");
      }

      const objectPath = `/api/storage${rawPath}`;
      res.json({ objectPath, size: req.file.size });
    } catch (error) {
      handleStorageError(req, res, error, "Failed to upload clip");
    }
  },
);

export default router;
