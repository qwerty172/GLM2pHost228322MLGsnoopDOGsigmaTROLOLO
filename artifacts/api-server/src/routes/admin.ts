import { Router, type IRouter, type RequestHandler } from "express";
import { eq, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  hostsTable,
  gamesTable,
  gameSubmissionsTable,
  hostGamesTable,
  sessionsTable,
} from "@workspace/db";
import { addToLibrary } from "../lib/hostLibrary";
import { rateLimit, ipKey } from "../lib/rateLimit";
import { timingSafeEqualString } from "../lib/timingSafe";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

function getHostFromAuthHeader(req: {
  headers: Record<string, string | string[] | undefined>;
}): string | null {
  const auth = req.headers["x-host-token"];
  if (!auth) return null;
  return Array.isArray(auth) ? auth[0] : auth;
}

// IP-keyed limiter across ALL admin routes — blocks brute-forcing of both
// the admin secret and host tokens against this surface.
const adminLimiter = rateLimit({
  scope: "admin",
  windowMs: 60_000,
  max: 30,
  keyFn: ipKey,
});
router.use("/admin", adminLimiter);

const requireAdmin: RequestHandler = async (req, res, next) => {
  // Defense in depth: admin access requires BOTH a host account flagged
  // isAdmin AND the deployment-level ADMIN_SECRET (X-Admin-Secret header).
  // A leaked/brute-forced host token alone is not enough.
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    res.status(503).json({
      error: "admin_disabled",
      message: "ADMIN_SECRET is not configured on the server",
    });
    return;
  }
  const providedSecretRaw = req.headers["x-admin-secret"];
  const providedSecret = Array.isArray(providedSecretRaw)
    ? providedSecretRaw[0]
    : providedSecretRaw;
  if (!providedSecret || !timingSafeEqualString(providedSecret, adminSecret)) {
    res.status(403).json({
      error: "admin_secret_required",
      message: "Missing or invalid X-Admin-Secret header",
    });
    return;
  }

  const token = getHostFromAuthHeader(req);
  if (!token) {
    res.status(401).json({ error: "Missing X-Host-Token header" });
    return;
  }
  const [host] = await db
    .select({ id: hostsTable.id, isAdmin: hostsTable.isAdmin })
    .from(hostsTable)
    .where(eq(hostsTable.hostToken, token));
  if (!host) {
    res.status(401).json({ error: "Unknown host token" });
    return;
  }
  if (!host.isAdmin) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  (req as any).adminHostId = host.id;
  next();
};

// ---------------------------------------------------------------------------
// GET /admin/games  — list all games including hidden ones
// ---------------------------------------------------------------------------

router.get(
  "/admin/games",
  requireAdmin,
  async (_req, res): Promise<void> => {
    const games = await db
      .select()
      .from(gamesTable)
      .orderBy(gamesTable.title);
    res.json(games);
  },
);

// ---------------------------------------------------------------------------
// GET /admin/games/submissions?status=pending
// ---------------------------------------------------------------------------

router.get(
  "/admin/games/submissions",
  requireAdmin,
  async (req, res): Promise<void> => {
    const statusFilter = (req.query.status as string) || "pending";
    const allowed = ["pending", "approved", "rejected", "all"];
    if (!allowed.includes(statusFilter)) {
      res
        .status(400)
        .json({ error: "status must be pending | approved | rejected | all" });
      return;
    }

    const conds =
      statusFilter === "all"
        ? undefined
        : eq(gameSubmissionsTable.status, statusFilter);

    const rows = await db
      .select({
        sub: gameSubmissionsTable,
        submitterName: hostsTable.displayName,
      })
      .from(gameSubmissionsTable)
      .innerJoin(hostsTable, eq(gameSubmissionsTable.hostId, hostsTable.id))
      .where(conds)
      .orderBy(desc(gameSubmissionsTable.createdAt));

    res.json(
      rows.map((r) => ({
        ...r.sub,
        submitterDisplayName: r.submitterName,
      })),
    );
  },
);

// ---------------------------------------------------------------------------
// POST /admin/games/submissions/:id/approve
// ---------------------------------------------------------------------------

const ApproveBody = z.object({
  title: z.string().optional(),
  slug: z.string().optional(),
  category: z.string().optional(),
  genres: z.array(z.string()).optional(),
  description: z.string().optional(),
  coverImageUrl: z.string().optional(),
  steamAppId: z.string().optional(),
});

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

router.post(
  "/admin/games/submissions/:id/approve",
  requireAdmin,
  async (req, res): Promise<void> => {
    const id = req.params["id"] as string;
    const adminHostId = (req as any).adminHostId as string;

    const parsed = ApproveBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const overrides = parsed.data;

    const [sub] = await db
      .select()
      .from(gameSubmissionsTable)
      .where(eq(gameSubmissionsTable.id, id));
    if (!sub) {
      res.status(404).json({ error: "Submission not found" });
      return;
    }
    if (sub.status !== "pending") {
      res
        .status(409)
        .json({ error: `Submission is already ${sub.status}` });
      return;
    }

    const title = overrides.title ?? sub.title;
    const rawSlug =
      overrides.slug || sub.slug || slugify(title);
    const finalSlug = slugify(rawSlug) || slugify(title);

    // Ensure slug is unique.
    const [existing] = await db
      .select({ id: gamesTable.id })
      .from(gamesTable)
      .where(eq(gamesTable.slug, finalSlug));
    if (existing) {
      res
        .status(409)
        .json({
          error: `A game with slug '${finalSlug}' already exists. Pass a unique slug in the request body.`,
        });
      return;
    }

    const [game] = await db
      .insert(gamesTable)
      .values({
        title,
        slug: finalSlug,
        category: overrides.category ?? sub.category,
        genres: overrides.genres ?? sub.genres,
        description: overrides.description ?? sub.description,
        coverImageUrl: overrides.coverImageUrl ?? sub.coverImageUrl,
        steamAppId: overrides.steamAppId ?? sub.steamAppId ?? undefined,
        // Copy kind → browserHostUrl for browser games.
        browserHostUrl:
          sub.kind === "browser" ? sub.defaultBrowserUrl : "",
      })
      .returning();

    if (!game) {
      res.status(500).json({ error: "Failed to create game" });
      return;
    }

    await db
      .update(gameSubmissionsTable)
      .set({
        status: "approved",
        reviewerId: adminHostId,
        reviewedAt: new Date(),
        approvedGameId: game.id,
      })
      .where(eq(gameSubmissionsTable.id, id));

    // If the submitter pre-configured a library entry, auto-create it now.
    let libraryAutoCreated = false;
    if (sub.pendingHostConfig) {
      const cfg = sub.pendingHostConfig;
      const addResult = await addToLibrary(sub.hostId, game.id, {
        pricePerMinuteLzt: cfg.pricePerMinuteLzt,
        appPath: cfg.appPath || undefined,
        boundUrl: cfg.boundUrl || undefined,
        launchArgs: cfg.launchArgs || undefined,
      });
      libraryAutoCreated = addResult.ok;
    }

    // Increment gamesContributed and set in-app notification on the submitter.
    await db
      .update(hostsTable)
      .set({
        gamesContributed: sql`${hostsTable.gamesContributed} + 1`,
        lastSubmissionStatus: "approved",
        lastSubmissionNote: libraryAutoCreated
          ? `Твоя заявка «${game.title}» одобрена и игра автоматически добавлена в твою библиотеку.`
          : `Твоя заявка «${game.title}» одобрена и добавлена в каталог.`,
      })
      .where(eq(hostsTable.id, sub.hostId));

    res.json({ approved: true, game, libraryAutoCreated });
  },
);

// ---------------------------------------------------------------------------
// POST /admin/games/submissions/:id/reject
// ---------------------------------------------------------------------------

const RejectBody = z.object({
  reason: z.string().min(1, "Rejection reason is required"),
});

router.post(
  "/admin/games/submissions/:id/reject",
  requireAdmin,
  async (req, res): Promise<void> => {
    const id = req.params["id"] as string;
    const adminHostId = (req as any).adminHostId as string;

    const parsed = RejectBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [sub] = await db
      .select()
      .from(gameSubmissionsTable)
      .where(eq(gameSubmissionsTable.id, id));
    if (!sub) {
      res.status(404).json({ error: "Submission not found" });
      return;
    }
    if (sub.status !== "pending") {
      res
        .status(409)
        .json({ error: `Submission is already ${sub.status}` });
      return;
    }

    await db
      .update(gameSubmissionsTable)
      .set({
        status: "rejected",
        reviewerId: adminHostId,
        reviewedAt: new Date(),
        rejectionReason: parsed.data.reason,
      })
      .where(eq(gameSubmissionsTable.id, id));

    // Set in-app notification on the submitter.
    await db
      .update(hostsTable)
      .set({
        lastSubmissionStatus: "rejected",
        lastSubmissionNote: `Твоя заявка «${sub.title}» отклонена. Причина: ${parsed.data.reason}`,
      })
      .where(eq(hostsTable.id, sub.hostId));

    res.json({ rejected: true });
  },
);


// ---------------------------------------------------------------------------
// DELETE /admin/games/:id  — permanently remove a game from the catalog
// ---------------------------------------------------------------------------

router.delete(
  "/admin/games/:id",
  requireAdmin,
  async (req, res): Promise<void> => {
    const id = req.params["id"] as string;

    const [game] = await db
      .select()
      .from(gamesTable)
      .where(eq(gamesTable.id, id));
    if (!game) {
      res.status(404).json({ error: "Game not found" });
      return;
    }

    // Refuse to delete if there are sessions referencing this game to avoid
    // breaking billing audit trails (sessions.game_id has onDelete: restrict).
    const sessionCheck = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sessionsTable)
      .where(eq(sessionsTable.gameId, id));
    if ((sessionCheck[0]?.count ?? 0) > 0) {
      res
        .status(409)
        .json({ error: "Cannot delete: active or historical sessions exist for this game. Hide it instead." });
      return;
    }

    await db.delete(gamesTable).where(eq(gamesTable.id, id));
    res.json({ deleted: true, id });
  },
);

// ---------------------------------------------------------------------------
// PATCH /admin/games/:id  — edit approved game metadata and/or toggle visibility.
//
// Accepts the game UUID as :id. Passing { isHidden: true/false } toggles
// visibility; other fields update metadata. All fields are optional.
// ---------------------------------------------------------------------------

const PatchGameBody = z.object({
  title: z.string().min(1).optional(),
  category: z.string().optional(),
  genres: z.array(z.string()).optional(),
  description: z.string().optional(),
  coverImageUrl: z.string().optional(),
  steamAppId: z.string().nullable().optional(),
  hasMods: z.boolean().optional(),
  isMultiplayer: z.boolean().optional(),
  hostSpectatesPlayer: z.boolean().optional(),
  hasQuests: z.boolean().optional(),
  browserHostUrl: z.string().optional(),
  isHidden: z.boolean().optional(),
});

router.patch(
  "/admin/games/:id",
  requireAdmin,
  async (req, res): Promise<void> => {
    const id = req.params["id"] as string;

    const parsed = PatchGameBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [game] = await db
      .select()
      .from(gamesTable)
      .where(eq(gamesTable.id, id));
    if (!game) {
      res.status(404).json({ error: "Game not found" });
      return;
    }

    const update: Partial<typeof gamesTable.$inferInsert> = {};
    const d = parsed.data;
    if (d.title !== undefined) update.title = d.title;
    if (d.category !== undefined) update.category = d.category;
    if (d.genres !== undefined) update.genres = d.genres;
    if (d.description !== undefined) update.description = d.description;
    if (d.coverImageUrl !== undefined) update.coverImageUrl = d.coverImageUrl;
    if (d.steamAppId !== undefined) update.steamAppId = d.steamAppId ?? undefined;
    if (d.hasMods !== undefined) update.hasMods = d.hasMods;
    if (d.isMultiplayer !== undefined) update.isMultiplayer = d.isMultiplayer;
    if (d.hostSpectatesPlayer !== undefined)
      update.hostSpectatesPlayer = d.hostSpectatesPlayer;
    if (d.hasQuests !== undefined) update.hasQuests = d.hasQuests;
    if (d.browserHostUrl !== undefined) update.browserHostUrl = d.browserHostUrl;
    if (d.isHidden !== undefined) update.isHidden = d.isHidden;

    if (Object.keys(update).length === 0) {
      res.json(game);
      return;
    }

    const [updated] = await db
      .update(gamesTable)
      .set(update)
      .where(eq(gamesTable.id, game.id))
      .returning();

    res.json(updated);
  },
);

export default router;
