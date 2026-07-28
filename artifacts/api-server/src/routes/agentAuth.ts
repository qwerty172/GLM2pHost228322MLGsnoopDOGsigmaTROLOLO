import { Router, type IRouter } from "express";
import { and, eq, gt, isNull, desc, sql } from "drizzle-orm";
import crypto from "node:crypto";
import { z } from "zod/v4";
import { db, hostsTable, agentPairingCodesTable } from "@workspace/db";
import { headerUserToken } from "../lib/requestToken";
import { requireHost } from "../lib/hostAuth";
import { rateLimit, ipKey, failedAttemptGuard, clearFailedAttempts } from "../lib/rateLimit";
import { getRedis } from "../lib/redis";
import { generateToken } from "../lib/tokens";

const router: IRouter = Router();

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const PAIRING_TTL_MS = 10 * 60 * 1000;
const CHALLENGE_TTL_SEC = Math.ceil(CHALLENGE_TTL_MS / 1000);

interface ChallengeEntry {
  expiresAt: number;
}
const challenges = new Map<string, ChallengeEntry>();

async function storeChallenge(challenge: string, expiresAt: number): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.setex(`agent:challenge:${challenge}`, CHALLENGE_TTL_SEC, String(expiresAt));
    return;
  }
  challenges.set(challenge, { expiresAt });
}

async function consumeChallenge(challenge: string): Promise<boolean> {
  const redis = getRedis();
  if (redis) {
    const key = `agent:challenge:${challenge}`;
    const raw = await redis.get(key);
    if (!raw) return false;
    await redis.del(key);
    const expiresAt = Number(raw);
    return Number.isFinite(expiresAt) && expiresAt >= Date.now();
  }
  const entry = challenges.get(challenge);
  if (!entry) return false;
  challenges.delete(challenge);
  if (entry.expiresAt < Date.now()) return false;
  return true;
}

function issueChallenge(): { challenge: string; expiresAt: number } {
  const now = Date.now();
  for (const [k, v] of challenges) {
    if (v.expiresAt < now) challenges.delete(k);
  }
  const challenge = crypto.randomBytes(32).toString("hex");
  const expiresAt = now + CHALLENGE_TTL_MS;
  void storeChallenge(challenge, expiresAt);
  return { challenge, expiresAt };
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

const bindLimiter = rateLimit({
  scope: "auth:bind-agent-key",
  windowMs: 15 * 60_000,
  max: 20,
  keyFn: ipKey,
});

const loginLimiter = rateLimit({
  scope: "auth:agent-login",
  windowMs: 15 * 60_000,
  max: 30,
  keyFn: ipKey,
});

const bindCodeIssueLimiter = rateLimit({
  scope: "auth:agent-bind-code",
  windowMs: 60_000,
  max: 10,
  keyFn: ipKey,
});

const BIND_CODE_TTL_MS = 10 * 60 * 1000;

interface BindCodeEntry {
  hostId: string;
  expiresAt: number;
}
const bindCodes = new Map<string, BindCodeEntry>();

function issueBindCode(hostId: string): { bindCode: string; expiresAt: number } {
  const now = Date.now();
  for (const [k, v] of bindCodes) {
    if (v.expiresAt < now) bindCodes.delete(k);
  }
  for (const [k, v] of bindCodes) {
    if (v.hostId === hostId) bindCodes.delete(k);
  }
  const bindCode = `bind_${generateToken(18)}`;
  const expiresAt = now + BIND_CODE_TTL_MS;
  bindCodes.set(bindCode, { hostId, expiresAt });
  return { bindCode, expiresAt };
}

function consumeBindCode(bindCode: string): string | null {
  const entry = bindCodes.get(bindCode);
  if (!entry) return null;
  bindCodes.delete(bindCode);
  if (entry.expiresAt < Date.now()) return null;
  return entry.hostId;
}

router.get("/auth/agent-challenge", (_req, res): void => {
  const { challenge, expiresAt } = issueChallenge();
  res.json({ challenge, expiresAt });
});

const revokeKeyLimiter = rateLimit({
  scope: "auth:revoke-agent-key",
  windowMs: 60_000,
  max: 10,
  keyFn: ipKey,
});

router.post("/auth/revoke-agent-key", revokeKeyLimiter, async (req, res): Promise<void> => {
  const auth = await requireHost(req);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  const wasBound = (auth.host.agentPubkey ?? "").length > 0;
  await db
    .update(hostsTable)
    .set({ agentPubkey: null })
    .where(eq(hostsTable.id, auth.host.id));

  req.log.info({ hostId: auth.host.id, wasBound }, "Agent public key revoked");
  res.json({ ok: true, wasBound });
});

router.post("/auth/agent-bind-code", bindCodeIssueLimiter, async (req, res): Promise<void> => {
  const auth = await requireHost(req);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }
  const { bindCode, expiresAt } = issueBindCode(auth.host.id);
  req.log.info({ hostId: auth.host.id }, "Agent bind code issued");
  res.json({ bindCode, expiresAt });
});

const BindAgentKeyBody = z
  .object({
    bindCode: z.string().min(1).optional(),
    hostToken: z.string().min(1).optional(),
    pubkey: z.string().regex(/^[0-9a-f]+$/i, "pubkey must be hex"),
    challenge: z.string().min(1),
    signature: z.string().regex(/^[0-9a-f]+$/i, "signature must be hex"),
  })
  .refine((b) => Boolean(b.bindCode || b.hostToken), {
    message: "bindCode or hostToken required",
  });

router.post("/auth/bind-agent-key", bindLimiter, async (req, res): Promise<void> => {
  const parsed = BindAgentKeyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { bindCode, hostToken, pubkey, challenge, signature } = parsed.data;

  if (!(await consumeChallenge(challenge))) {
    res.status(400).json({ error: "Challenge expired or already used" });
    return;
  }

  if (!verifyEd25519(pubkey, challenge, signature)) {
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  let hostId: string | null = null;
  if (bindCode) {
    hostId = consumeBindCode(bindCode);
    if (!hostId) {
      res.status(400).json({ error: "Bind code expired or already used" });
      return;
    }
  } else if (hostToken) {
    const [host] = await db
      .select({ id: hostsTable.id })
      .from(hostsTable)
      .where(eq(hostsTable.hostToken, hostToken));
    if (!host) {
      res.status(404).json({ error: "Host not found" });
      return;
    }
    hostId = host.id;
  }

  if (!hostId) {
    res.status(400).json({ error: "bindCode or hostToken required" });
    return;
  }

  const [updated] = await db
    .update(hostsTable)
    .set({ agentPubkey: pubkey })
    .where(
      sql`${hostsTable.id} = ${hostId} AND (${hostsTable.agentPubkey} IS NULL OR ${hostsTable.agentPubkey} = '' OR ${hostsTable.agentPubkey} = ${pubkey})`,
    )
    .returning({ id: hostsTable.id, agentPubkey: hostsTable.agentPubkey });

  if (!updated) {
    res
      .status(409)
      .json({ error: "A different key is already bound to this account" });
    return;
  }

  req.log.info({ hostId: updated.id }, "Agent public key bound");
  res.json({ ok: true });
});

const AgentLoginBody = z.object({
  pubkey: z.string().regex(/^[0-9a-f]+$/i, "pubkey must be hex"),
  challenge: z.string().min(1),
  signature: z.string().regex(/^[0-9a-f]+$/i, "signature must be hex"),
});

router.post("/auth/agent-login", loginLimiter, async (req, res): Promise<void> => {
  const parsed = AgentLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { pubkey, challenge, signature } = parsed.data;

  if (!(await consumeChallenge(challenge))) {
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
