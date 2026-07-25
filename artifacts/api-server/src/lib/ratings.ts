import { eq, and } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db, hostsTable, sessionRatingsTable } from "@workspace/db";
import { writeLedger } from "./economy";

export async function submitSessionRating(args: {
  sessionId: string;
  playerId: string;
  hostId: string;
  score: number;
  comment?: string;
}): Promise<{ ok: true; ratingAvg: number; ratingCount: number } | { ok: false; error: string }> {
  if (!Number.isInteger(args.score) || args.score < 1 || args.score > 5) {
    return { ok: false, error: "score must be 1–5" };
  }

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: sessionRatingsTable.id })
      .from(sessionRatingsTable)
      .where(
        and(
          eq(sessionRatingsTable.sessionId, args.sessionId),
          eq(sessionRatingsTable.playerId, args.playerId),
        ),
      )
      .limit(1);
    if (existing) {
      return { ok: false, error: "already_rated" };
    }

    await tx.insert(sessionRatingsTable).values({
      sessionId: args.sessionId,
      playerId: args.playerId,
      hostId: args.hostId,
      score: args.score,
      comment: (args.comment ?? "").slice(0, 500),
    });

    const [host] = await tx
      .select({
        ratingAvg: hostsTable.ratingAvg,
        ratingCount: hostsTable.ratingCount,
      })
      .from(hostsTable)
      .where(eq(hostsTable.id, args.hostId));
    const prevCount = host?.ratingCount ?? 0;
    const prevAvg = host?.ratingAvg != null ? Number(host.ratingAvg) : null;
    const newCount = prevCount + 1;
    const newAvg =
      prevAvg == null
        ? args.score
        : Math.round(((prevAvg * prevCount + args.score) / newCount) * 100) / 100;

    await tx
      .update(hostsTable)
      .set({
        ratingAvg: String(newAvg),
        ratingCount: newCount,
      })
      .where(eq(hostsTable.id, args.hostId));

    return { ok: true, ratingAvg: newAvg, ratingCount: newCount };
  });
}

export async function recordBlockReserveLedger(args: {
  playerId: string;
  sessionId: string;
  amountLzt: number;
  bucket: "green" | "blue";
  note: string;
}): Promise<void> {
  if (args.amountLzt <= 0) return;
  await db.transaction(async (tx) => {
    await writeLedger(tx, [
      {
        groupId: randomUUID(),
        kind: "block_reserve",
        ownerType: "player",
        ownerId: args.playerId,
        bucket: args.bucket === "green" ? "cash" : "balance",
        deltaLzt: -args.amountLzt,
        refType: "session",
        refId: args.sessionId,
        note: args.note,
      },
    ]);
  });
}
