// Agent authentication routes — Ed25519-based passwordless login for host agents.
//
// Flow:
//   1. GET  /api/auth/agent-challenge              → { challenge, expiresAt }
//   2. POST /api/auth/bind-agent-key               → binds pubkey to a host account
//   3. POST /api/auth/agent-login                  → returns hostToken after sig verification

import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";
import { z } from "zod/v4";
import { db, hostsTable } from "@workspace/db";

const router: IRouter = Router();

// ── In-memory challenge store ─────────────────────────────────────────────────
// Challenges are one-time nonces with a short TTL.  The map is periodically
// pruned so memory doesn't grow unboundedly.

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface ChallengeEntry {
  expiresAt: number;
}
const challenges = new Map<string, ChallengeEntry>();

function issueChallenge(): { challenge: string; expiresAt: number } {
  // Prune expired entries on every issue to keep the map small.
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
  challenges.delete(challenge); // one-time use
  if (entry.expiresAt < Date.now()) return false;
  return true;
}

// ── Signature verification ────────────────────────────────────────────────────

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

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/auth/agent-challenge
// Returns a fresh one-time challenge the agent must sign.
router.get("/auth/agent-challenge", (_req, res): void => {
  const { challenge, expiresAt } = issueChallenge();
  res.json({ challenge, expiresAt });
});

// POST /api/auth/bind-agent-key
// Associates an Ed25519 public key with an existing host account.
// Body: { hostToken, pubkey, challenge, signature }
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

  // Reject if a *different* pubkey is already bound (prevent key takeover).
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

// POST /api/auth/agent-login
// Verifies the agent's signature and returns the hostToken so the agent can
// open the web dashboard pre-authenticated.
// Body: { pubkey, challenge, signature }
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

export default router;
