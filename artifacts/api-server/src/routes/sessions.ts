import { Router, type IRouter } from "express";
import { eq, and, or, isNull } from "drizzle-orm";
import {
  db,
  hostsTable,
  playersTable,
  sessionsTable,
} from "@workspace/db";
import {
  CreateSessionBody,
  GetSessionResponse,
  GetSessionParams,
  GetSessionQueryParams,
  GetSessionByPlayerTokenParams,
  GetSessionByPlayerTokenResponse,
  EndSessionParams,
  EndSessionBody,
  EndSessionResponse,
  ClaimSessionParams,
  ClaimSessionBody,
  ClaimSessionResponse,
} from "@workspace/api-zod";

import { generateToken } from "../lib/tokens";

const router: IRouter = Router();

function serialize(s: typeof sessionsTable.$inferSelect) {
  return {
    ...s,
    ratePerMinute: Number(s.ratePerMinute),
  };
}

router.post("/sessions", async (req, res): Promise<void> => {
  const parsed = CreateSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [host] = await db
    .select()
    .from(hostsTable)
    .where(eq(hostsTable.hostToken, parsed.data.hostToken));

  if (!host) {
    res.status(404).json({ error: "Host not found" });
    return;
  }

  const playerToken = generateToken();
  const ratePerMinute = parsed.data.ratePerMinute ?? 0.04;
  if (!Number.isFinite(ratePerMinute) || ratePerMinute <= 0 || ratePerMinute > 100) {
    res.status(400).json({ error: "ratePerMinute must be > 0 and <= 100" });
    return;
  }
  const [session] = await db
    .insert(sessionsTable)
    .values({
      hostId: host.id,
      playerToken,
      appName: parsed.data.appName,
      resolution: parsed.data.resolution ?? "1920x1080",
      bitrateKbps: parsed.data.bitrateKbps ?? 6000,
      ratePerMinute: String(ratePerMinute),
    })
    .returning();

  if (!session) {
    res.status(500).json({ error: "Failed to create session" });
    return;
  }

  req.log.info({ sessionId: session.id }, "Session created");
  res.status(201).json(GetSessionResponse.parse(serialize(session)));
});

router.get(
  "/sessions/by-player-token/:playerToken",
  async (req, res): Promise<void> => {
    const params = GetSessionByPlayerTokenParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [session] = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.playerToken, params.data.playerToken));

    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    res.json(GetSessionByPlayerTokenResponse.parse(serialize(session)));
  },
);

router.post(
  "/sessions/by-player-token/:playerToken/claim",
  async (req, res): Promise<void> => {
    const params = ClaimSessionParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const body = ClaimSessionBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const [session] = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.playerToken, params.data.playerToken));
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    if (session.status === "ended") {
      res.status(400).json({ error: "Session has ended" });
      return;
    }

    const [player] = await db
      .select()
      .from(playersTable)
      .where(eq(playersTable.playerToken, body.data.playerWalletToken));
    if (!player) {
      res.status(404).json({ error: "Player wallet not found" });
      return;
    }

    if (
      session.claimedByPlayerId &&
      session.claimedByPlayerId !== player.id
    ) {
      res.status(400).json({ error: "Session already claimed by another player" });
      return;
    }

    const minBalance = Number(session.ratePerMinute);
    if (Number(player.creditBalance) < minBalance) {
      res.status(400).json({
        error: `Insufficient balance — need at least ${minBalance} credits to start`,
      });
      return;
    }

    const [updated] = await db
      .update(sessionsTable)
      .set({ claimedByPlayerId: player.id })
      .where(
        and(
          eq(sessionsTable.id, session.id),
          or(
            isNull(sessionsTable.claimedByPlayerId),
            eq(sessionsTable.claimedByPlayerId, player.id),
          ),
        ),
      )
      .returning();

    if (!updated) {
      res.status(409).json({ error: "Session already claimed by another player" });
      return;
    }

    req.log.info(
      { sessionId: updated.id, playerId: player.id },
      "Session claimed",
    );
    res.json(ClaimSessionResponse.parse(serialize(updated)));
  },
);

router.get("/sessions/:id", async (req, res): Promise<void> => {
  const params = GetSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const query = GetSessionQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const [host] = await db
    .select()
    .from(hostsTable)
    .where(eq(hostsTable.hostToken, query.data.hostToken));
  if (!host) {
    res.status(403).json({ error: "Invalid host token" });
    return;
  }

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, params.data.id));

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  if (session.hostId !== host.id) {
    res.status(403).json({ error: "Not your session" });
    return;
  }

  res.json(GetSessionResponse.parse(serialize(session)));
});

router.patch("/sessions/:id/end", async (req, res): Promise<void> => {
  const params = EndSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = EndSessionBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [host] = await db
    .select()
    .from(hostsTable)
    .where(eq(hostsTable.hostToken, body.data.hostToken));
  if (!host) {
    res.status(403).json({ error: "Invalid host token" });
    return;
  }

  const [existing] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  if (existing.hostId !== host.id) {
    res.status(403).json({ error: "Not your session" });
    return;
  }

  const [session] = await db
    .update(sessionsTable)
    .set({ status: "ended", endedAt: new Date() })
    .where(eq(sessionsTable.id, params.data.id))
    .returning();

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  req.log.info({ sessionId: session.id }, "Session ended");
  res.json(EndSessionResponse.parse(serialize(session)));
});

export default router;
