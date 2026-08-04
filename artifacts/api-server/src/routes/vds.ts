import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, quotaVdsTable, quotasTable, hostsTable } from "@workspace/db";
import { resolveOwnerByToken } from "../lib/walletOwner";
import { encryptSshKey, decryptSshKey } from "../lib/sshKey";
import { isWalletCryptoEnabled } from "../lib/encryption";
import { logger } from "../lib/logger";
import { resolvesToPrivateNetwork } from "../lib/ssrfGuard";

const router: IRouter = Router();

const TestConnectionBody = z.object({
  ownerToken: z.string().min(1),
  sshHost: z.string().min(1),
  sshPort: z.number().int().min(1).max(65535).optional().default(22),
  sshUser: z.string().min(1),
  sshKey: z.string().min(1),
});

const SaveVdsBody = z.object({
  ownerToken: z.string().min(1),
  provider: z.string().optional().default("ssh"),
  sshHost: z.string().min(1),
  sshPort: z.number().int().min(1).max(65535).optional().default(22),
  sshUser: z.string().min(1),
  sshKey: z.string().min(1),
});

async function sshConnect(
  host: string,
  port: number,
  user: string,
  privateKey: string,
): Promise<{ ok: boolean; error?: string }> {
  let ssh2Mod: typeof import("ssh2") | null = null;
  try {
    ssh2Mod = await import("ssh2");
  } catch {
    return { ok: false, error: "ssh2 module unavailable" };
  }
  const { Client } = ssh2Mod;
  return new Promise((resolve) => {
    const conn = new Client();
    const t = setTimeout(() => {
      conn.destroy();
      resolve({ ok: false, error: "Timed out after 10s" });
    }, 10_000);
    conn.on("ready", () => {
      clearTimeout(t);
      conn.end();
      resolve({ ok: true });
    });
    conn.on("error", (err: Error) => {
      clearTimeout(t);
      resolve({ ok: false, error: err.message });
    });
    try {
      conn.connect({ host, port, username: user, privateKey, readyTimeout: 10_000 });
    } catch (err) {
      clearTimeout(t);
      resolve({ ok: false, error: err instanceof Error ? err.message : "Connect error" });
    }
  });
}

// POST /api/quotas/vds/test-connection
// Test SSH reachability without saving anything. Accepts raw key (never stored here).
router.post("/quotas/vds/test-connection", async (req, res): Promise<void> => {
  const parsed = TestConnectionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { ownerToken, sshHost, sshPort, sshUser, sshKey } = parsed.data;

  const owner = await resolveOwnerByToken(ownerToken);
  if (!owner) {
    res.status(403).json({ error: "Not authenticated" });
    return;
  }

  if (await resolvesToPrivateNetwork(sshHost)) {
    res.status(400).json({ ok: false, error: "Host is not reachable from the platform" });
    return;
  }

  try {
    const result = await sshConnect(sshHost, sshPort, sshUser, sshKey);
    if (result.ok) {
      res.json({ ok: true });
    } else {
      res.status(400).json({ ok: false, error: result.error });
    }
  } catch (err) {
    logger.error({ err }, "VDS test-connection error");
    res.status(500).json({ ok: false, error: "Internal error" });
  }
});

// POST /api/quotas/:quotaId/vds
// Save VDS config for a quota (owner only). Creates or replaces.
router.post("/quotas/:quotaId/vds", async (req, res): Promise<void> => {
  const quotaId = req.params.quotaId ?? "";
  const parsed = SaveVdsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { ownerToken, provider, sshHost, sshPort, sshUser, sshKey } = parsed.data;

  const owner = await resolveOwnerByToken(ownerToken);
  if (!owner) {
    res.status(403).json({ error: "Not authenticated" });
    return;
  }

  const [quota] = await db
    .select()
    .from(quotasTable)
    .where(eq(quotasTable.id, quotaId));
  if (!quota) {
    res.status(404).json({ error: "Quota not found" });
    return;
  }
  if (quota.ownerId !== owner.id || quota.ownerType !== owner.type) {
    res.status(403).json({ error: "Not your quota" });
    return;
  }

  if (await resolvesToPrivateNetwork(sshHost)) {
    res.status(400).json({ ok: false, error: "Host is not reachable from the platform" });
    return;
  }

  if (!isWalletCryptoEnabled()) {
    res.status(503).json({
      error: "encryption_unavailable",
      message: "Шифрование не настроено (WALLET_ENCRYPTION_KEY)",
    });
    return;
  }

  let sshKeyEncrypted: string;
  try {
    sshKeyEncrypted = encryptSshKey(sshKey);
  } catch {
    res.status(503).json({
      error: "encryption_unavailable",
      message: "Шифрование не настроено (WALLET_ENCRYPTION_KEY)",
    });
    return;
  }

  const [existing] = await db
    .select()
    .from(quotaVdsTable)
    .where(eq(quotaVdsTable.quotaId, quotaId));

  let row: typeof quotaVdsTable.$inferSelect;
  if (existing) {
    const [updated] = await db
      .update(quotaVdsTable)
      .set({
        provider,
        sshHost,
        sshPort,
        sshUser,
        sshKeyEncrypted,
        status: "pending",
        provisionLog: "",
        hostId: null,
        lastHealthAt: null,
        updatedAt: new Date(),
      })
      .where(eq(quotaVdsTable.id, existing.id))
      .returning();
    row = updated!;
  } else {
    const [created] = await db
      .insert(quotaVdsTable)
      .values({
        quotaId,
        provider,
        sshHost,
        sshPort,
        sshUser,
        sshKeyEncrypted,
        status: "pending",
      })
      .returning();
    row = created!;
  }

  res.status(existing ? 200 : 201).json(shapeVds(row));
});

// GET /api/quotas/:quotaId/vds
// Get VDS config for a quota (owner only). SSH key is never returned.
router.get("/quotas/:quotaId/vds", async (req, res): Promise<void> => {
  const quotaId = req.params.quotaId ?? "";
  const ownerToken = req.query.ownerToken ? String(req.query.ownerToken) : "";
  if (!ownerToken) {
    res.status(400).json({ error: "ownerToken required" });
    return;
  }
  const owner = await resolveOwnerByToken(ownerToken);
  if (!owner) {
    res.status(403).json({ error: "Not authenticated" });
    return;
  }

  const [quota] = await db
    .select()
    .from(quotasTable)
    .where(eq(quotasTable.id, quotaId));
  if (!quota) {
    res.status(404).json({ error: "Quota not found" });
    return;
  }
  if (quota.ownerId !== owner.id || quota.ownerType !== owner.type) {
    res.status(403).json({ error: "Not your quota" });
    return;
  }

  const [vds] = await db
    .select()
    .from(quotaVdsTable)
    .where(eq(quotaVdsTable.quotaId, quotaId));

  if (!vds) {
    res.status(404).json({ error: "No VDS configured" });
    return;
  }

  res.json(shapeVds(vds));
});

// DELETE /api/quotas/:quotaId/vds
router.delete("/quotas/:quotaId/vds", async (req, res): Promise<void> => {
  const quotaId = req.params.quotaId ?? "";
  const ownerToken = req.query.ownerToken ? String(req.query.ownerToken) : "";
  if (!ownerToken) {
    res.status(400).json({ error: "ownerToken required" });
    return;
  }
  const owner = await resolveOwnerByToken(ownerToken);
  if (!owner) {
    res.status(403).json({ error: "Not authenticated" });
    return;
  }

  const [quota] = await db
    .select()
    .from(quotasTable)
    .where(eq(quotasTable.id, quotaId));
  if (!quota || quota.ownerId !== owner.id || quota.ownerType !== owner.type) {
    res.status(403).json({ error: "Not your quota" });
    return;
  }

  await db
    .delete(quotaVdsTable)
    .where(eq(quotaVdsTable.quotaId, quotaId));

  res.json({ ok: true });
});

// GET /api/vds/mine  — owner's VDS list across all quotas, with host uptime
router.get("/vds/mine", async (req, res): Promise<void> => {
  const ownerToken = req.query.ownerToken ? String(req.query.ownerToken) : "";
  if (!ownerToken) {
    res.status(400).json({ error: "ownerToken required" });
    return;
  }
  const owner = await resolveOwnerByToken(ownerToken);
  if (!owner) {
    res.status(403).json({ error: "Not authenticated" });
    return;
  }

  const ownerQuotas = await db
    .select({ id: quotasTable.id, title: quotasTable.title })
    .from(quotasTable)
    .where(
      and(
        eq(quotasTable.ownerType, owner.type),
        eq(quotasTable.ownerId, owner.id),
      ),
    );

  if (ownerQuotas.length === 0) {
    res.json([]);
    return;
  }

  const quotaIds = ownerQuotas.map((q) => q.id);
  const rows = await db.select().from(quotaVdsTable);
  const filtered = rows.filter((r) => quotaIds.includes(r.quotaId));

  const quotaTitle = new Map(ownerQuotas.map((q) => [q.id, q.title]));

  // For each VDS, fetch host earnings if hostId set
  const results = await Promise.all(
    filtered.map(async (vds) => {
      let earnedLzt = 0;
      if (vds.hostId) {
        const [host] = await db
          .select({
            withdrawableBalanceLzt: hostsTable.withdrawableBalanceLzt,
            internalBalanceLzt: hostsTable.internalBalanceLzt,
          })
          .from(hostsTable)
          .where(eq(hostsTable.id, vds.hostId));
        if (host) {
          earnedLzt =
            host.withdrawableBalanceLzt + host.internalBalanceLzt;
        }
      }
      return {
        ...shapeVds(vds),
        quotaTitle: quotaTitle.get(vds.quotaId) ?? null,
        earnedLzt,
      };
    }),
  );

  res.json(results);
});

function shapeVds(vds: typeof quotaVdsTable.$inferSelect) {
  return {
    id: vds.id,
    quotaId: vds.quotaId,
    provider: vds.provider,
    sshHost: vds.sshHost,
    sshPort: vds.sshPort,
    sshUser: vds.sshUser,
    status: vds.status,
    provisionLog: vds.provisionLog,
    lastHealthAt: vds.lastHealthAt ? vds.lastHealthAt.toISOString() : null,
    hostId: vds.hostId,
    createdAt: vds.createdAt.toISOString(),
    updatedAt: vds.updatedAt.toISOString(),
  };
}

export default router;
