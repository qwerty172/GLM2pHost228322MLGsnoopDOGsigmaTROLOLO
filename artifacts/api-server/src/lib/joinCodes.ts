import { eq, and, gt } from "drizzle-orm";
import { db, joinCodesTable, sessionsTable } from "@workspace/db";
import { generateJoinCode } from "./tokens";
import { isPublicInviteSession } from "./sessionInviteAccess";

/** Join codes remain valid for 15 minutes; reusable until expiry (F5/reconnect). */
export const JOIN_CODE_TTL_MS = 15 * 60 * 1000;

export async function ensureJoinCodeForSession(
  sessionId: string,
): Promise<string> {
  const now = new Date();
  const [existing] = await db
    .select({ code: joinCodesTable.code })
    .from(joinCodesTable)
    .where(
      and(
        eq(joinCodesTable.sessionId, sessionId),
        gt(joinCodesTable.expiresAt, now),
      ),
    )
    .limit(1);
  if (existing) return existing.code;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateJoinCode();
    const expiresAt = new Date(now.getTime() + JOIN_CODE_TTL_MS);
    try {
      await db.insert(joinCodesTable).values({ code, sessionId, expiresAt });
      return code;
    } catch {
      // Unique collision — retry.
    }
  }
  throw new Error("Failed to mint join code");
}

export async function exchangeJoinCode(
  code: string,
): Promise<{ playerToken: string; sessionId: string } | null> {
  const normalized = code.toUpperCase();
  const now = new Date();
  const [row] = await db
    .select({
      sessionId: joinCodesTable.sessionId,
      expiresAt: joinCodesTable.expiresAt,
      playerToken: sessionsTable.playerToken,
      status: sessionsTable.status,
      devKeyId: sessionsTable.devKeyId,
    })
    .from(joinCodesTable)
    .innerJoin(sessionsTable, eq(joinCodesTable.sessionId, sessionsTable.id))
    .where(eq(joinCodesTable.code, normalized))
    .limit(1);

  if (!row || row.expiresAt <= now || !isPublicInviteSession(row)) return null;
  return { playerToken: row.playerToken, sessionId: row.sessionId };
}

/** Mint a fresh join code for a legacy playerToken link (one-time URL cleanup). */
export async function ensureJoinCodeForPlayerToken(
  playerToken: string,
): Promise<string | null> {
  const [session] = await db
    .select({ id: sessionsTable.id, status: sessionsTable.status })
    .from(sessionsTable)
    .where(eq(sessionsTable.playerToken, playerToken))
    .limit(1);
  if (!session || session.status === "ended") return null;
  return ensureJoinCodeForSession(session.id);
}
