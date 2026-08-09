import { db, sessionsTable } from "@workspace/db";
import { countSessionMinutesUsed } from "./sessionBilling";

export function baseSerialize(s: typeof sessionsTable.$inferSelect) {
  return {
    ...s,
    ratePerMinute: Number(s.ratePerMinute),
  };
}

export async function enrichSession(s: typeof sessionsTable.$inferSelect) {
  const base = baseSerialize(s);
  let blockMinsRemaining: number | null = null;
  if (s.blockMinutes) {
    const used = await countSessionMinutesUsed(db, s.id);
    blockMinsRemaining = Math.max(0, s.blockMinutes - used);
  }
  return { ...base, blockMinsRemaining };
}

export async function enrichSessionBatch(
  sessions: Array<typeof sessionsTable.$inferSelect>,
) {
  return Promise.all(sessions.map((s) => enrichSession(s)));
}
