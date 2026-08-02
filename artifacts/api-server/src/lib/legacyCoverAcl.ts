import { or, eq } from "drizzle-orm";
import { db, gamesTable, gameSubmissionsTable } from "@workspace/db";
import { coverUrlVariants } from "./storageObjectPath";

/** True when the object is referenced as a catalog cover (legacy, no ACL metadata). */
export async function isLegacyCatalogCover(objectPath: string): Promise<boolean> {
  const variants = coverUrlVariants(objectPath);
  if (variants.length === 0) return false;

  const gameMatch = or(
    ...variants.map((variant) => eq(gamesTable.coverImageUrl, variant)),
  );

  const [gameHit] = await db
    .select({ id: gamesTable.id })
    .from(gamesTable)
    .where(gameMatch)
    .limit(1);
  if (gameHit) return true;

  const submissionMatch = or(
    ...variants.map((variant) => eq(gameSubmissionsTable.coverImageUrl, variant)),
  );

  const [submissionHit] = await db
    .select({ id: gameSubmissionsTable.id })
    .from(gameSubmissionsTable)
    .where(submissionMatch)
    .limit(1);

  return Boolean(submissionHit);
}
