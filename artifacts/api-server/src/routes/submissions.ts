import { Router, type IRouter } from "express";
import { eq, and, count, ilike, or } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  hostsTable,
  gamesTable,
  gameSubmissionsTable,
} from "@workspace/db";

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

  // Deduplication: check if a game already exists with this title or slug.
  const titleLower = normalizedTitle.toLowerCase();
  const existingGames = await db
    .select({ id: gamesTable.id, slug: gamesTable.slug, title: gamesTable.title })
    .from(gamesTable)
    .where(
      normalizedSlug
        ? or(ilike(gamesTable.title, titleLower), eq(gamesTable.slug, normalizedSlug))
        : ilike(gamesTable.title, titleLower),
    );
  if (existingGames.length > 0) {
    const match = existingGames[0]!;
    res.status(409).json({
      error: "A game with this title already exists in the catalog. Add it to your host library instead.",
      existingGame: { id: match.id, slug: match.slug, title: match.title },
    });
    return;
  }

  // Deduplication: check for an existing pending submission with same title or slug.
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
        normalizedSlug
          ? or(
              ilike(gameSubmissionsTable.title, titleLower),
              eq(gameSubmissionsTable.slug, normalizedSlug),
            )
          : ilike(gameSubmissionsTable.title, titleLower),
      ),
    );
  if (pendingSubs.length > 0) {
    const match = pendingSubs[0]!;
    res.status(409).json({
      error: "A pending submission with this title already exists. Check its status or wait for admin review.",
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

  res.status(201).json(sub);
});

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
