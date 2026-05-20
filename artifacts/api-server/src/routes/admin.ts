import { Router, type IRouter, type RequestHandler } from "express";
import { eq, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  hostsTable,
  gamesTable,
  gameSubmissionsTable,
} from "@workspace/db";

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

const requireAdmin: RequestHandler = async (req, res, next) => {
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

    // Increment gamesContributed and set in-app notification on the submitter.
    await db
      .update(hostsTable)
      .set({
        gamesContributed: sql`${hostsTable.gamesContributed} + 1`,
        lastSubmissionStatus: "approved",
        lastSubmissionNote: `Твоя заявка «${game.title}» одобрена и добавлена в каталог.`,
      })
      .where(eq(hostsTable.id, sub.hostId));

    res.json({ approved: true, game });
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
// PATCH /admin/games/:slug  — edit approved game metadata
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
});

router.patch(
  "/admin/games/:slug",
  requireAdmin,
  async (req, res): Promise<void> => {
    const slug = req.params["slug"] as string;

    const parsed = PatchGameBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [game] = await db
      .select()
      .from(gamesTable)
      .where(eq(gamesTable.slug, slug));
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
