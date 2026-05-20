import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { db, gamesTable, hostGamesTable, sessionsTable } from "@workspace/db";

export type LibraryEntry = {
  id: string;
  hostId: string;
  gameId: string;
  pricePerMinuteLzt: number;
  appPath: string;
  boundUrl: string;
  launchArgs: string;
  enabled: boolean;
  sortOrder: number;
  localAvailable: boolean;
  lastError: string;
  addedAt: Date;
  hasActiveSession: boolean;
  game: {
    id: string;
    slug: string;
    title: string;
    coverImageUrl: string;
    genre: string;
    browserHostUrl: string;
    hasMods: boolean;
    isMultiplayer: boolean;
  };
};

export async function listLibrary(hostId: string): Promise<LibraryEntry[]> {
  const rows = await db
    .select()
    .from(hostGamesTable)
    .innerJoin(gamesTable, eq(hostGamesTable.gameId, gamesTable.id))
    .where(eq(hostGamesTable.hostId, hostId))
    .orderBy(asc(hostGamesTable.sortOrder), asc(hostGamesTable.addedAt));

  if (rows.length === 0) return [];

  const gameIds = rows.map((r) => r.host_games.gameId);
  const activeSessions = await db
    .select({ gameId: sessionsTable.gameId })
    .from(sessionsTable)
    .where(
      and(
        eq(sessionsTable.hostId, hostId),
        inArray(sessionsTable.gameId, gameIds),
        ne(sessionsTable.status, "ended"),
      ),
    );
  const activeGameIds = new Set(activeSessions.map((s) => s.gameId));

  return rows.map((r) => ({
    id: r.host_games.id,
    hostId: r.host_games.hostId,
    gameId: r.host_games.gameId,
    pricePerMinuteLzt: r.host_games.pricePerMinuteLzt,
    appPath: r.host_games.appPath,
    boundUrl: r.host_games.boundUrl,
    launchArgs: r.host_games.launchArgs,
    enabled: r.host_games.enabled,
    sortOrder: r.host_games.sortOrder,
    localAvailable: r.host_games.localAvailable,
    lastError: r.host_games.lastError,
    addedAt: r.host_games.addedAt,
    hasActiveSession: activeGameIds.has(r.host_games.gameId),
    game: {
      id: r.games.id,
      slug: r.games.slug,
      title: r.games.title,
      coverImageUrl: r.games.coverImageUrl,
      genre: r.games.genre,
      browserHostUrl: r.games.browserHostUrl,
      hasMods: r.games.hasMods,
      isMultiplayer: r.games.isMultiplayer,
    },
  }));
}

export type AddToLibraryOpts = {
  pricePerMinuteLzt: number;
  appPath?: string;
  boundUrl?: string;
  launchArgs?: string;
};

export type AddToLibraryResult =
  | { ok: true; entry: LibraryEntry }
  | { ok: false; reason: string; status: number };

export async function addToLibrary(
  hostId: string,
  gameId: string,
  opts: AddToLibraryOpts,
): Promise<AddToLibraryResult> {
  if (opts.pricePerMinuteLzt < 0) {
    return { ok: false, reason: "pricePerMinuteLzt must be >= 0", status: 400 };
  }
  if (opts.pricePerMinuteLzt > 200_000) {
    return { ok: false, reason: "pricePerMinuteLzt too high (max 200,000 = $1,000/min)", status: 400 };
  }

  const [game] = await db
    .select()
    .from(gamesTable)
    .where(eq(gamesTable.id, gameId));
  if (!game) {
    return { ok: false, reason: "Game not found", status: 404 };
  }

  // Determine game type from catalog. A game with a non-empty browserHostUrl
  // is a browser-streamable title; everything else is a native executable.
  const isBrowser = game.browserHostUrl !== "";

  if (isBrowser) {
    // Browser game: boundUrl is required (override) or falls back to the
    // game's default URL.  The caller must at least confirm a valid URL.
    const resolvedUrl = opts.boundUrl?.trim() || game.browserHostUrl;
    if (!resolvedUrl) {
      return { ok: false, reason: "Browser game requires a boundUrl", status: 400 };
    }
    try {
      const u = new URL(resolvedUrl);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        return { ok: false, reason: "boundUrl must use http or https", status: 400 };
      }
    } catch {
      return { ok: false, reason: "boundUrl is not a valid URL", status: 400 };
    }
  } else {
    // Native game: appPath to the executable is required so the host agent
    // can launch it. Empty string is rejected.
    const resolvedPath = opts.appPath?.trim() ?? "";
    if (resolvedPath === "") {
      return {
        ok: false,
        reason: "Native game requires an appPath (absolute path to the .exe)",
        status: 400,
      };
    }
  }

  const existingRows = await db
    .select({ id: hostGamesTable.id })
    .from(hostGamesTable)
    .where(and(eq(hostGamesTable.hostId, hostId), eq(hostGamesTable.gameId, gameId)));
  if (existingRows.length > 0) {
    return { ok: false, reason: "Game already in library", status: 409 };
  }

  const maxSortRow = await db
    .select({ s: hostGamesTable.sortOrder })
    .from(hostGamesTable)
    .where(eq(hostGamesTable.hostId, hostId))
    .orderBy(asc(hostGamesTable.sortOrder));
  const nextSort = maxSortRow.length > 0
    ? (maxSortRow[maxSortRow.length - 1]?.s ?? 0) + 1
    : 0;

  await db.insert(hostGamesTable).values({
    hostId,
    gameId,
    pricePerMinuteLzt: opts.pricePerMinuteLzt,
    appPath: opts.appPath?.trim() ?? "",
    boundUrl: opts.boundUrl?.trim() ?? (isBrowser ? game.browserHostUrl : ""),
    launchArgs: opts.launchArgs?.trim() ?? "",
    sortOrder: nextSort,
  });

  const entries = await listLibrary(hostId);
  const created = entries.find((e) => e.gameId === gameId);
  if (!created) {
    return { ok: false, reason: "Failed to retrieve created entry", status: 500 };
  }
  return { ok: true, entry: created };
}

export type UpdateEntryOpts = {
  pricePerMinuteLzt?: number;
  appPath?: string;
  boundUrl?: string;
  launchArgs?: string;
  enabled?: boolean;
  sortOrder?: number;
  localAvailable?: boolean;
  lastError?: string;
};

export type UpdateEntryResult =
  | { ok: true; entry: LibraryEntry }
  | { ok: false; reason: string; status: number };

export async function updateEntry(
  hostId: string,
  gameId: string,
  opts: UpdateEntryOpts,
): Promise<UpdateEntryResult> {
  if (opts.pricePerMinuteLzt !== undefined) {
    if (opts.pricePerMinuteLzt < 0) {
      return { ok: false, reason: "pricePerMinuteLzt must be >= 0", status: 400 };
    }
    if (opts.pricePerMinuteLzt > 200_000) {
      return { ok: false, reason: "pricePerMinuteLzt too high", status: 400 };
    }
  }

  const [[existing], [game]] = await Promise.all([
    db
      .select()
      .from(hostGamesTable)
      .where(and(eq(hostGamesTable.hostId, hostId), eq(hostGamesTable.gameId, gameId))),
    db
      .select()
      .from(gamesTable)
      .where(eq(gamesTable.id, gameId)),
  ]);
  if (!existing) {
    return { ok: false, reason: "Library entry not found", status: 404 };
  }

  // Game-type-aware path/URL validation — same rules as addToLibrary.
  const isBrowser = game?.browserHostUrl !== "";
  if (opts.appPath !== undefined && !isBrowser) {
    if (opts.appPath.trim() === "") {
      return {
        ok: false,
        reason: "Native game requires a non-empty appPath",
        status: 400,
      };
    }
  }
  if (opts.boundUrl !== undefined && isBrowser && opts.boundUrl.trim() !== "") {
    try {
      const u = new URL(opts.boundUrl.trim());
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        return { ok: false, reason: "boundUrl must use http or https", status: 400 };
      }
    } catch {
      return { ok: false, reason: "boundUrl is not a valid URL", status: 400 };
    }
  }

  const patch: Partial<typeof hostGamesTable.$inferInsert> = {};
  if (opts.pricePerMinuteLzt !== undefined) patch.pricePerMinuteLzt = opts.pricePerMinuteLzt;
  if (opts.appPath !== undefined) patch.appPath = opts.appPath.trim();
  if (opts.boundUrl !== undefined) patch.boundUrl = opts.boundUrl.trim();
  if (opts.launchArgs !== undefined) patch.launchArgs = opts.launchArgs.trim();
  if (opts.enabled !== undefined) patch.enabled = opts.enabled;
  if (opts.sortOrder !== undefined) patch.sortOrder = opts.sortOrder;
  if (opts.localAvailable !== undefined) patch.localAvailable = opts.localAvailable;
  if (opts.lastError !== undefined) patch.lastError = opts.lastError;

  if (Object.keys(patch).length > 0) {
    await db
      .update(hostGamesTable)
      .set(patch)
      .where(and(eq(hostGamesTable.hostId, hostId), eq(hostGamesTable.gameId, gameId)));
  }

  const entries = await listLibrary(hostId);
  const updated = entries.find((e) => e.gameId === gameId);
  if (!updated) {
    return { ok: false, reason: "Failed to retrieve updated entry", status: 500 };
  }
  return { ok: true, entry: updated };
}

export type RemoveFromLibraryResult =
  | { ok: true }
  | { ok: false; reason: string; status: number };

export async function removeFromLibrary(
  hostId: string,
  gameId: string,
): Promise<RemoveFromLibraryResult> {
  const [existing] = await db
    .select()
    .from(hostGamesTable)
    .where(and(eq(hostGamesTable.hostId, hostId), eq(hostGamesTable.gameId, gameId)));
  if (!existing) {
    return { ok: false, reason: "Library entry not found", status: 404 };
  }

  const activeSessions = await db
    .select({ id: sessionsTable.id })
    .from(sessionsTable)
    .where(
      and(
        eq(sessionsTable.hostId, hostId),
        eq(sessionsTable.gameId, gameId),
      ),
    );
  const hasActive = activeSessions.some(
    (s) => s.id,
  );
  if (hasActive) {
    const liveCheck = await db
      .select({ id: sessionsTable.id, status: sessionsTable.status })
      .from(sessionsTable)
      .where(
        and(
          eq(sessionsTable.hostId, hostId),
          eq(sessionsTable.gameId, gameId),
        ),
      );
    if (liveCheck.some((s) => s.status !== "ended")) {
      return {
        ok: false,
        reason: "Cannot remove: there is an active session for this game",
        status: 409,
      };
    }
  }

  await db
    .delete(hostGamesTable)
    .where(and(eq(hostGamesTable.hostId, hostId), eq(hostGamesTable.gameId, gameId)));

  return { ok: true };
}

// Returns all hosts that have this game enabled in their library,
// regardless of whether they have a live session. Used by public catalog.
export async function findHostsForGame(gameId: string) {
  return db
    .select()
    .from(hostGamesTable)
    .where(and(eq(hostGamesTable.gameId, gameId), eq(hostGamesTable.enabled, true)));
}
