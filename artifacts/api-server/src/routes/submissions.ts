import { Router, type IRouter } from "express";
import { eq, and, count, ilike, or } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  hostsTable,
  gamesTable,
  gameSubmissionsTable,
} from "@workspace/db";
import { tryApplyObjectAcl } from "../lib/storageRouteHelpers";

const router: IRouter = Router();

const MAX_PENDING_PER_HOST = 5;
const MAX_COVER_URL_LENGTH = 2048;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isValidHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

const SubmitGameBody = z.object({
  // Host token identifying the submitter.
  hostToken: z.string().min(1),
  title: z.string().min(1).max(200),
  // Optional slug. Auto-generated from title on approve if omitted.
  slug: z.string().max(120).optional(),
  category: z.string().max(80).default(""),
  genres: z.array(z.string().max(60)).max(10).default([]),
  description: z.string().max(4000).default(""),
  // External image URL OR object-storage path from a previous upload.
  coverImageUrl: z.string().max(MAX_COVER_URL_LENGTH).default(""),
  kind: z.enum(["native", "browser"]).default("native"),
  // Required when kind = 'browser'.
  defaultBrowserUrl: z.string().max(2048).default(""),
  steamAppId: z.string().max(20).optional(),
});

// POST /games/submit — any authenticated host can propose a new catalog entry.
router.post("/games/submit", async (req, res): Promise<void> => {
  const parsed = SubmitGameBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const body = parsed.data;

  // Validate cover image URL when provided.
  if (
    body.coverImageUrl &&
    !body.coverImageUrl.startsWith("/") &&
    !isValidHttpUrl(body.coverImageUrl)
  ) {
    res
      .status(400)
      .json({ error: "coverImageUrl must be a valid http(s) URL or storage path" });
    return;
  }

  // Browser games require a defaultBrowserUrl.
  if (body.kind === "browser" && !body.defaultBrowserUrl.trim()) {
    res
      .status(400)
      .json({ error: "defaultBrowserUrl is required for browser-kind games" });
    return;
  }
  if (body.defaultBrowserUrl && !isValidHttpUrl(body.defaultBrowserUrl)) {
    res
      .status(400)
      .json({ error: "defaultBrowserUrl must be a valid http(s) URL" });
    return;
  }

  // Resolve host.
  const [host] = await db
    .select({ id: hostsTable.id })
    .from(hostsTable)
    .where(eq(hostsTable.hostToken, body.hostToken));
  if (!host) {
    res.status(401).json({ error: "Unknown hostToken" });
    return;
  }

  const normalizedTitle = body.title.trim();
  const normalizedSlug = body.slug ? slugify(body.slug) : "";

  // Deduplication: check if a game already exists with this title, slug, or steamAppId.
  const titleLower = normalizedTitle.toLowerCase();
  const steamId = body.steamAppId?.trim() || null;

  const gameDeupConds = [ilike(gamesTable.title, titleLower)];
  if (normalizedSlug) gameDeupConds.push(eq(gamesTable.slug, normalizedSlug));
  if (steamId) gameDeupConds.push(eq(gamesTable.steamAppId, steamId));

  const existingGames = await db
    .select({ id: gamesTable.id, slug: gamesTable.slug, title: gamesTable.title })
    .from(gamesTable)
    .where(or(...gameDeupConds));
  if (existingGames.length > 0) {
    const match = existingGames[0]!;
    res.status(409).json({
      error: "A game matching this title, slug, or Steam App ID already exists. Add it to your host library instead.",
      existingGame: { id: match.id, slug: match.slug, title: match.title },
    });
    return;
  }

  // Deduplication: check for an existing pending submission with same title, slug, or steamAppId.
  const subDeupConds = [ilike(gameSubmissionsTable.title, titleLower)];
  if (normalizedSlug) subDeupConds.push(eq(gameSubmissionsTable.slug, normalizedSlug));
  if (steamId) subDeupConds.push(eq(gameSubmissionsTable.steamAppId, steamId));

  const pendingSubs = await db
    .select({
      id: gameSubmissionsTable.id,
      title: gameSubmissionsTable.title,
      slug: gameSubmissionsTable.slug,
    })
    .from(gameSubmissionsTable)
    .where(
      and(
        eq(gameSubmissionsTable.status, "pending"),
        or(...subDeupConds),
      ),
    );
  if (pendingSubs.length > 0) {
    const match = pendingSubs[0]!;
    res.status(409).json({
      error: "A pending submission matching this title, slug, or Steam App ID already exists.",
      existingSubmission: { id: match.id, title: match.title },
    });
    return;
  }

  // Rate limit: ≤5 pending submissions per host.
  const [{ pendingCount }] = await db
    .select({ pendingCount: count() })
    .from(gameSubmissionsTable)
    .where(
      and(
        eq(gameSubmissionsTable.hostId, host.id),
        eq(gameSubmissionsTable.status, "pending"),
      ),
    );
  if (Number(pendingCount) >= MAX_PENDING_PER_HOST) {
    res.status(429).json({
      error: `You already have ${MAX_PENDING_PER_HOST} pending submissions. Wait for them to be reviewed before submitting more.`,
    });
    return;
  }

  const [sub] = await db
    .insert(gameSubmissionsTable)
    .values({
      hostId: host.id,
      status: "pending",
      title: normalizedTitle,
      slug: normalizedSlug,
      category: body.category,
      genres: body.genres,
      description: body.description,
      coverImageUrl: body.coverImageUrl,
      kind: body.kind,
      defaultBrowserUrl: body.defaultBrowserUrl,
      steamAppId: body.steamAppId ?? undefined,
    })
    .returning();

  if (body.coverImageUrl) {
    await tryApplyObjectAcl(body.coverImageUrl, {
      owner: `host:${host.id}`,
      visibility: "public",
    }, req);
  }

  res.status(201).json(sub);
});

// PATCH /games/submissions/:id/pending-config — save host launch config
// before the game is approved, so the platform can auto-create the library
// entry on approval.
const PendingConfigBody = z.object({
  hostToken: z.string().min(1),
  pricePerMinuteLzt: z.number().min(0).max(200000),
  appPath: z.string().max(1024).default(""),
  boundUrl: z.string().max(2048).default(""),
  launchArgs: z.string().max(1024).default(""),
});

router.patch(
  "/games/submissions/:id/pending-config",
  async (req, res): Promise<void> => {
    const id = req.params["id"] as string;
    const parsed = PendingConfigBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { hostToken, ...config } = parsed.data;

    const [host] = await db
      .select({ id: hostsTable.id })
      .from(hostsTable)
      .where(eq(hostsTable.hostToken, hostToken));
    if (!host) {
      res.status(401).json({ error: "Unknown hostToken" });
      return;
    }

    const [sub] = await db
      .select({ id: gameSubmissionsTable.id, status: gameSubmissionsTable.status, hostId: gameSubmissionsTable.hostId })
      .from(gameSubmissionsTable)
      .where(eq(gameSubmissionsTable.id, id));
    if (!sub) {
      res.status(404).json({ error: "Submission not found" });
      return;
    }
    if (sub.hostId !== host.id) {
      res.status(403).json({ error: "Not your submission" });
      return;
    }
    if (sub.status !== "pending") {
      res.status(409).json({ error: `Submission is already ${sub.status}` });
      return;
    }

    await db
      .update(gameSubmissionsTable)
      .set({ pendingHostConfig: config })
      .where(eq(gameSubmissionsTable.id, id));

    res.json({ saved: true });
  },
);

// GET /games/submissions/my — list submissions by the authenticated host.
router.get("/games/submissions/my", async (req, res): Promise<void> => {
  const token =
    (req.headers["x-host-token"] as string) ||
    (req.query.hostToken as string);
  if (!token) {
    res.status(401).json({ error: "Missing X-Host-Token header or hostToken query param" });
    return;
  }

  const [host] = await db
    .select({ id: hostsTable.id })
    .from(hostsTable)
    .where(eq(hostsTable.hostToken, token));
  if (!host) {
    res.status(401).json({ error: "Unknown host token" });
    return;
  }

  const subs = await db
    .select()
    .from(gameSubmissionsTable)
    .where(eq(gameSubmissionsTable.hostId, host.id))
    .orderBy(gameSubmissionsTable.createdAt);

  res.json(subs);
});

export default router;
