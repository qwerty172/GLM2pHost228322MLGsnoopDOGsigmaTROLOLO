import { eq, and, sql } from "drizzle-orm";
import { db, billingEventsTable, sessionsTable } from "@workspace/db";
import { ensureJoinCodeForSession } from "./joinCodes";

export function baseSerialize(s: typeof sessionsTable.$inferSelect) {
  return {
    ...s,
    ratePerMinute: Number(s.ratePerMinute),
  };
}

async function countBlockMinutesUsed(sessionId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(billingEventsTable)
    .where(
      and(
        eq(billingEventsTable.sessionId, sessionId),
        eq(billingEventsTable.kind, "session_tick"),
        eq(billingEventsTable.bucket, "green"),
      ),
    );
  return Number(row?.n ?? 0);
}

export async function enrichSession(s: typeof sessionsTable.$inferSelect) {
  const base = baseSerialize(s);
  let blockMinsRemaining: number | null = null;
  if (s.blockMinutes) {
    const used = await countBlockMinutesUsed(s.id);
    blockMinsRemaining = Math.max(0, s.blockMinutes - used);
  }
  let joinCode: string | null = null;
  if (s.status !== "ended") {
    try {
      joinCode = await ensureJoinCodeForSession(s.id);
    } catch {
      joinCode = null;
    }
  }
  return { ...base, blockMinsRemaining, joinCode };
}

export async function enrichSessionBatch(
  sessions: Array<typeof sessionsTable.$inferSelect>,
) {
  return Promise.all(sessions.map((s) => enrichSession(s)));
}
