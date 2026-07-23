import { Router, type IRouter } from "express";
import { and, eq, gt, isNull, desc } from "drizzle-orm";
import crypto from "node:crypto";
import { z } from "zod/v4";
import { db, hostsTable, agentPairingCodesTable } from "@workspace/db";
import { headerUserToken } from "../lib/requestToken";
import { rateLimit, ipKey, failedAttemptGuard, clearFailedAttempts } from "../lib/rateLimit";

const router: IRouter = Router();

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const PAIRING_TTL_MS = 10 * 60 * 1000;

interface ChallengeEntry {
  expiresAt: number;
}
const challenges = new Map<string, ChallengeEntry>();

function issueChallenge(): { challenge: string; expiresAt: number } {
  const now = Date.now();
  for (const [k, v] of challenges) {
    if (v.expiresAt < now) challenges.delete(k);
  }
  const challenge = crypto.randomBytes(32).toString("hex");
  const expiresAt = now + CHALLENGE_TTL_MS;
  challenges.set(challenge, { expiresAt });
  return { challenge, expiresAt };
}

function consumeChallenge(challenge: string): boolean {
  const entry = challenges.get(challenge);
  if (!entry) return false;
  challenges.delete(challenge);
  if (entry.expiresAt < Date.now()) return false;
  return true;
}

function verifyEd25519(
  pubkeyHex: string,
  challenge: string,
  signatureHex: string,
): boolean {
  try {
    const pubkey = crypto.createPublicKey({
      key: Buffer.from(pubkeyHex, "hex"),
      format: "der",
      type: "spki",
    });
    return crypto.verify(
      null,
      Buffer.from(challenge, "utf-8"),
      pubkey,
      Buffer.from(signatureHex, "hex"),
    );
  } catch {
    return false;
  }
}

function generatePairingCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

async function resolveHostFromHeader(req: import("express").Request) {
  const hostToken = headerUserToken(req);
  if (!hostToken) return null;
  const [host] = await db
    .select({
      id: hostsTable.id,
      hostToken: hostsTable.hostToken,
      displayName: hostsTable.displayName,
    })
    .from(hostsTable)
    .where(eq(hostsTable.hostToken, hostToken));
  return host ?? null;
}

const pairLimiter = rateLimit({
  scope: "agent:pair",
  windowMs: 60_000,
  max: 10,
  keyFn: ipKey,
});

router.get("/auth/agent-challenge", (_req, res): void => {
  const { challenge, expiresAt } = issueChallenge();
  res.json({ challenge, expiresAt });
});

const BindAgentKeyBody = z.object({
  hostToken: z.string().min(1),
  pubkey: z.string().regex(/^[0-9a-f]+$/i, "pubkey must be hex"),
  challenge: z.string().min(1),
  signature: z.string().regex(/^[0-9a-f]+$/i, "signature must be hex"),
});

router.post("/auth/bind-agent-key", async (req, res): Promise<void> => {
  const parsed = BindAgentKeyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { hostToken, pubkey, challenge, signature } = parsed.data;

  if (!consumeChallenge(challenge)) {
    res.status(400).json({ error: "Challenge expired or already used" });
    return;
  }

  if (!verifyEd25519(pubkey, challenge, signature)) {
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  const [host] = await db
    .select({ id: hostsTable.id })
    .from(hostsTable)
    .where(eq(hostsTable.hostToken, hostToken));
  if (!host) {
    res.status(404).json({ error: "Host not found" });
    return;
  }

  const [existing] = await db
    .select({ agentPubkey: hostsTable.agentPubkey })
    .from(hostsTable)
    .where(eq(hostsTable.id, host.id));
  if (existing?.agentPubkey && existing.agentPubkey !== pubkey) {
    res
      .status(409)
      .json({ error: "A different key is already bound to this account" });
    return;
  }

  await db
    .update(hostsTable)
    .set({ agentPubkey: pubkey })
    .where(eq(hostsTable.id, host.id));

  req.log.info({ hostId: host.id }, "Agent public key bound");
  res.json({ ok: true });
});

const AgentLoginBody = z.object({
  pubkey: z.string().regex(/^[0-9a-f]+$/i, "pubkey must be hex"),
  challenge: z.string().min(1),
  signature: z.string().regex(/^[0-9a-f]+$/i, "signature must be hex"),
});

router.post("/auth/agent-login", async (req, res): Promise<void> => {
  const parsed = AgentLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { pubkey, challenge, signature } = parsed.data;

  if (!consumeChallenge(challenge)) {
    res.status(400).json({ error: "Challenge expired or already used" });
    return;
  }

  if (!verifyEd25519(pubkey, challenge, signature)) {
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  const [host] = await db
    .select({ id: hostsTable.id, hostToken: hostsTable.hostToken })
    .from(hostsTable)
    .where(eq(hostsTable.agentPubkey, pubkey));
  if (!host) {
    res.status(404).json({ error: "No host bound to this key" });
    return;
  }

  req.log.info({ hostId: host.id }, "Agent login via key signature");
  res.json({ hostToken: host.hostToken });
});

// POST /api/auth/agent-pairing-code — host dashboard generates a 6-digit code
router.post("/auth/agent-pairing-code", async (req, res): Promise<void> => {
  const host = await resolveHostFromHeader(req);
  if (!host) {
    res.status(401).json({ error: "Host token required" });
    return;
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + PAIRING_TTL_MS);

  await db
    .update(agentPairingCodesTable)
    .set({ usedAt: now })
    .where(
      and(
        eq(agentPairingCodesTable.hostId, host.id),
        isNull(agentPairingCodesTable.usedAt),
        gt(agentPairingCodesTable.expiresAt, now),
      ),
    );

  let code = generatePairingCode();
  for (let i = 0; i < 5; i++) {
    const [conflict] = await db
      .select({ id: agentPairingCodesTable.id })
      .from(agentPairingCodesTable)
      .where(
        and(
          eq(agentPairingCodesTable.code, code),
          isNull(agentPairingCodesTable.usedAt),
          gt(agentPairingCodesTable.expiresAt, now),
        ),
      );
    if (!conflict) break;
    code = generatePairingCode();
  }

  await db.insert(agentPairingCodesTable).values({
    hostId: host.id,
    code,
    expiresAt,
  });

  res.json({ code, expiresAt: expiresAt.toISOString() });
});

// GET /api/auth/agent-pairing-status
router.get("/auth/agent-pairing-status", async (req, res): Promise<void> => {
  const host = await resolveHostFromHeader(req);
  if (!host) {
    res.status(401).json({ error: "Host token required" });
    return;
  }

  const now = new Date();
  const [used] = await db
    .select({ usedAt: agentPairingCodesTable.usedAt })
    .from(agentPairingCodesTable)
    .where(
      and(
        eq(agentPairingCodesTable.hostId, host.id),
        gt(agentPairingCodesTable.usedAt, new Date(now.getTime() - 60_000)),
      ),
    )
    .orderBy(desc(agentPairingCodesTable.usedAt))
    .limit(1);

  if (used?.usedAt) {
    res.json({ status: "paired", pairedAt: used.usedAt.toISOString() });
    return;
  }

  const [pending] = await db
    .select({ expiresAt: agentPairingCodesTable.expiresAt })
    .from(agentPairingCodesTable)
    .where(
      and(
        eq(agentPairingCodesTable.hostId, host.id),
        isNull(agentPairingCodesTable.usedAt),
        gt(agentPairingCodesTable.expiresAt, now),
      ),
    )
    .limit(1);

  if (pending) {
    res.json({ status: "pending", expiresAt: pending.expiresAt.toISOString() });
    return;
  }

  res.json({ status: "expired" });
});

const AgentPairBody = z.object({
  code: z.string().regex(/^\d{6}$/),
  agentPubkey: z.string().regex(/^[0-9a-f]+$/i).optional(),
});

// POST /api/auth/agent-pair — agent submits 6-digit code, receives hostToken
router.post(
  "/auth/agent-pair",
  pairLimiter,
  failedAttemptGuard("agent:pair"),
  async (req, res): Promise<void> => {
    const parsed = AgentPairBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { code, agentPubkey } = parsed.data;
    const now = new Date();

    const [row] = await db
      .select({
        id: agentPairingCodesTable.id,
        hostId: agentPairingCodesTable.hostId,
      })
      .from(agentPairingCodesTable)
      .where(
        and(
          eq(agentPairingCodesTable.code, code),
          isNull(agentPairingCodesTable.usedAt),
          gt(agentPairingCodesTable.expiresAt, now),
        ),
      );

    if (!row) {
      res.status(401).json({ error: "Invalid or expired pairing code" });
      return;
    }

    const [host] = await db
      .select({
        hostToken: hostsTable.hostToken,
        displayName: hostsTable.displayName,
      })
      .from(hostsTable)
      .where(eq(hostsTable.id, row.hostId));

    if (!host) {
      res.status(404).json({ error: "Host not found" });
      return;
    }

    await db
      .update(agentPairingCodesTable)
      .set({ usedAt: now, agentPubkey: agentPubkey ?? null })
      .where(eq(agentPairingCodesTable.id, row.id));

    if (agentPubkey) {
      await db
        .update(hostsTable)
        .set({ agentPubkey: agentPubkey })
        .where(eq(hostsTable.id, row.hostId));
    }

    await clearFailedAttempts("agent:pair", req);
    req.log.info({ hostId: row.hostId }, "Agent paired via 6-digit code");
    res.json({ hostToken: host.hostToken, displayName: host.displayName });
  },
);

export default router;
