import { db, gamesTable, gameSubmissionsTable } from "@workspace/db";
import { or, sql } from "drizzle-orm";
import { normalizeStorageObjectPath } from "./storageObjectPath";

function coverUrlMatchesObject(coverImageUrl: unknown, objectPath: string): boolean {
  if (typeof coverImageUrl !== "string" || !coverImageUrl.trim()) return false;
  const normalized = normalizeStorageObjectPath(coverImageUrl);
  return normalized === objectPath;
}

/**
 * True when the object is referenced as a catalog cover in games or submissions.
 * Legacy rows without ACL metadata remain publicly readable only via this check.
 */
export async function isCatalogCoverObjectPath(objectPath: string): Promise<boolean> {
  const normalized = normalizeStorageObjectPath(objectPath);
  if (!normalized) return false;

  const objectSuffix = normalized.slice("/objects/".length);
  const likePattern = `%/objects/${objectSuffix}`;

  const [game] = await db
    .select({ id: gamesTable.id, coverImageUrl: gamesTable.coverImageUrl })
    .from(gamesTable)
    .where(
      or(
        sql`${gamesTable.coverImageUrl} LIKE ${likePattern}`,
        sql`${gamesTable.coverImageUrl} = ${normalized}`,
        sql`${gamesTable.coverImageUrl} = ${`/api/storage${normalized}`}`,
      ),
    )
    .limit(1);

  if (game && coverUrlMatchesObject(game.coverImageUrl, normalized)) {
    return true;
  }

  const [submission] = await db
    .select({
      id: gameSubmissionsTable.id,
      coverImageUrl: gameSubmissionsTable.coverImageUrl,
    })
    .from(gameSubmissionsTable)
    .where(
      or(
        sql`${gameSubmissionsTable.coverImageUrl} LIKE ${likePattern}`,
        sql`${gameSubmissionsTable.coverImageUrl} = ${normalized}`,
        sql`${gameSubmissionsTable.coverImageUrl} = ${`/api/storage${normalized}`}`,
      ),
    )
    .limit(1);

  return !!(submission && coverUrlMatchesObject(submission.coverImageUrl, normalized));
}
