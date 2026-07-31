import { pool } from "@workspace/db";
import { logger } from "./logger";
import {
  isObjectStorageConfigured,
  ObjectStorageService,
} from "./objectStorage";
import { getObjectAclPolicy, setObjectAclPolicy } from "./objectAcl";
import { coverUrlToObjectPath } from "./storageAclPaths";

export { coverUrlToObjectPath } from "./storageAclPaths";

const LEGACY_COVER_OWNER = "system:legacy-cover";

/**
 * Idempotent startup backfill: objects referenced as game covers without ACL
 * metadata get `visibility: public` so they remain readable after legacy
 * public-read fallback is removed.
 */
export async function runStorageAclBackfill(): Promise<void> {
  if (!isObjectStorageConfigured()) {
    return;
  }

  const client = await pool.connect();
  let objectPaths: string[];
  try {
    const { rows } = await client.query<{ cover_image_url: string }>(`
      SELECT DISTINCT cover_image_url
      FROM (
        SELECT cover_image_url FROM games
        UNION ALL
        SELECT cover_image_url FROM game_submissions
      ) covers
      WHERE cover_image_url LIKE '/api/storage/objects/%'
         OR cover_image_url LIKE '/objects/%'
    `);
    objectPaths = [
      ...new Set(
        rows
          .map((r) => coverUrlToObjectPath(r.cover_image_url))
          .filter((p): p is string => p !== null),
      ),
    ];
  } finally {
    client.release();
  }

  if (objectPaths.length === 0) {
    return;
  }

  const storage = new ObjectStorageService();
  let applied = 0;

  for (const objectPath of objectPaths) {
    try {
      const objectFile = await storage.getObjectEntityFile(objectPath);
      const existing = await getObjectAclPolicy(objectFile);
      if (existing) {
        continue;
      }

      await setObjectAclPolicy(objectFile, {
        owner: LEGACY_COVER_OWNER,
        visibility: "public",
      });
      applied++;
    } catch (err) {
      logger.warn({ err, objectPath }, "Storage ACL backfill skipped for object");
    }
  }

  if (applied > 0) {
    logger.info({ applied, scanned: objectPaths.length }, "Storage ACL legacy cover backfill applied");
  }
}
