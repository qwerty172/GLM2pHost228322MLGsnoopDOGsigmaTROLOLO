import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  db,
  devKeysTable,
  dripSchedulesTable,
  hostsTable,
  ledgerTable,
  playersTable,
  systemAccountsTable,
  withdrawalsTable,
} from "@workspace/db";
import { requireAdmin } from "../lib/adminAuth";
import {
  getPlatformSettings,
  updatePlatformSettings,
} from "../lib/platformSettings";
import { generateToken } from "../lib/tokens";
import { ensureDepositAddressesForOwner } from "../lib/walletOwner";
import {
  adjustUserBucket,
  drawFromSystemAccount,
  writeLedger,
  SYSTEM_DRIP_RESERVE,
  SYSTEM_INTEREST_RESERVE,
  SYSTEM_PLATFORM_FEES,
  type OwnerType,
  type UserBucket,
} from "../lib/economy";
import { rateLimit, ipKey } from "../lib/rateLimit";

const router: IRouter = Router();

router.use("/admin/economy", requireAdmin);

const economyWriteLimiter = rateLimit({
  scope: "admin:economy-write",
  windowMs: 60_000,
  max: 30,
  keyFn: ipKey,
});

function maskApiKey(key: string): string {
  if (key.length <= 12) return key;
  return `${key.slice(0, 10)}…${key.slice(-4)}`;
}

async function resolveOwner(
  ownerType: OwnerType,
  tokenOrId: string,
): Promise<{ id: string } | null> {
  const trimmed = tokenOrId.trim();
  if (ownerType === "player") {
    const [byToken] = await db
      .select({ id: playersTable.id })
      .from(playersTable)
      .where(eq(playersTable.playerToken, trimmed));
    if (byToken) return byToken;
    const [byId] = await db
      .select({ id: playersTable.id })
      .from(playersTable)
      .where(eq(playersTable.id, trimmed));
    return byId ?? null;
  }
  if (ownerType === "host") {
    const [byToken] = await db
      .select({ id: hostsTable.id })
      .from(hostsTable)
      .where(eq(hostsTable.hostToken, trimmed));
    if (byToken) return byToken;
    const [byId] = await db
      .select({ id: hostsTable.id })
      .from(hostsTable)
      .where(eq(hostsTable.id, trimmed));
    return byId ?? null;
  }
  const [byKey] = await db
    .select({ id: devKeysTable.id })
    .from(devKeysTable)
    .where(eq(devKeysTable.apiKey, trimmed));
  if (byKey) return byKey;
  const [byId] = await db
    .select({ id: devKeysTable.id })
    .from(devKeysTable)
    .where(eq(devKeysTable.id, trimmed));
  return byId ?? null;
}

// GET /admin/economy/settings
router.get("/admin/economy/settings", async (_req, res): Promise<void> => {
  const settings = await getPlatformSettings(true);
  res.json(settings);
});

const patchSettingsSchema = z.object({
  weeklyInterestRateHbps: z.number().int().min(0).max(10_000).optional(),
  guestCreditLimitLzt: z.number().int().min(0).max(10_000_000).optional(),
  defaultCreditLimitLzt: z.number().int().min(0).max(10_000_000).optional(),
  welcomeBonusLzt: z.number().int().min(0).max(10_000_000).optional(),
  interestEnabled: z.boolean().optional(),
});

router.patch(
  "/admin/economy/settings",
  economyWriteLimiter,
  async (req, res): Promise<void> => {
    const parsed = patchSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    if (Object.keys(parsed.data).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }
    const updated = await updatePlatformSettings(parsed.data);
    req.log.info({ fields: Object.keys(parsed.data) }, "Platform settings updated");
    res.json(updated);
  },
);

// GET /admin/economy/reserves
router.get("/admin/economy/reserves", async (_req, res): Promise<void> => {
  const accounts = await db.select().from(systemAccountsTable);
  const [{ count: pendingWithdrawals }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(withdrawalsTable)
    .where(inArray(withdrawalsTable.status, ["pending", "processing"]));

  res.json({
    systemAccounts: accounts.map((a) => ({
      key: a.key,
      balanceLzt: a.balanceLzt,
      updatedAt: a.updatedAt,
    })),
    pendingWithdrawals: Number(pendingWithdrawals) || 0,
    knownKeys: [
      SYSTEM_INTEREST_RESERVE,
      SYSTEM_PLATFORM_FEES,
      SYSTEM_DRIP_RESERVE,
    ],
  });
});

// GET /admin/economy/dev-keys
router.get("/admin/economy/dev-keys", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(devKeysTable)
    .orderBy(desc(devKeysTable.createdAt));
  res.json(
    rows.map((r) => ({
      id: r.id,
      apiKeyMasked: maskApiKey(r.apiKey),
      displayName: r.displayName,
      status: r.status,
      internalBalanceLzt: r.internalBalanceLzt,
      withdrawableBalanceLzt: r.withdrawableBalanceLzt,
      hostRules: r.hostRulesJson ?? {},
      createdAt: r.createdAt,
    })),
  );
});

const createDevKeySchema = z.object({
  displayName: z.string().max(200).optional(),
  hostRules: z
    .object({
      maxPricePerMinuteLzt: z.number().int().nonnegative().optional(),
      tags: z.array(z.string().min(1)).max(20).optional(),
    })
    .optional(),
  initialBalanceLzt: z.number().int().min(0).max(50_000_000).optional(),
});

router.post(
  "/admin/economy/dev-keys",
  economyWriteLimiter,
  async (req, res): Promise<void> => {
    const parsed = createDevKeySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const apiKey = `lzt_key_${generateToken(24)}`;
    const [created] = await db
      .insert(devKeysTable)
      .values({
        apiKey,
        displayName: parsed.data.displayName?.trim() || "",
        hostRulesJson: parsed.data.hostRules ?? {},
      })
      .returning();

    if (!created) {
      res.status(500).json({ error: "Failed to create API key" });
      return;
    }

    await ensureDepositAddressesForOwner("dev_key", created.id);

    const initial = parsed.data.initialBalanceLzt ?? 0;
    if (initial > 0) {
      const adminHostId = (req as { adminHostId?: string }).adminHostId;
      await db.transaction(async (tx) => {
        const ok = await adjustUserBucket(
          tx,
          "dev_key",
          created.id,
          "balance",
          initial,
        );
        if (!ok) throw new Error("initial_balance_failed");
        const groupId = randomUUID();
        await writeLedger(tx, [
          {
            groupId,
            kind: "admin_grant",
            ownerType: "dev_key",
            ownerId: created.id,
            bucket: "balance",
            deltaLzt: initial,
            refType: "admin_host",
            refId: adminHostId ?? null,
            note: "initial dev key balance",
          },
        ]);
      });
    }

    const [fresh] = await db
      .select()
      .from(devKeysTable)
      .where(eq(devKeysTable.id, created.id));

    res.status(201).json({
      apiKey,
      id: created.id,
      displayName: fresh?.displayName ?? created.displayName,
      status: fresh?.status ?? created.status,
      internalBalanceLzt: fresh?.internalBalanceLzt ?? initial,
      withdrawableBalanceLzt: fresh?.withdrawableBalanceLzt ?? 0,
    });
  },
);

const patchDevKeySchema = z.object({
  status: z.enum(["active", "disabled"]).optional(),
  displayName: z.string().max(200).optional(),
  hostRules: createDevKeySchema.shape.hostRules,
});

router.patch(
  "/admin/economy/dev-keys/:id",
  economyWriteLimiter,
  async (req, res): Promise<void> => {
    const id = String(req.params.id ?? "").trim();
    if (!id) {
      res.status(400).json({ error: "id required" });
      return;
    }
    const parsed = patchDevKeySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const patch: Partial<typeof devKeysTable.$inferInsert> = {};
    if (parsed.data.status !== undefined) patch.status = parsed.data.status;
    if (parsed.data.displayName !== undefined) {
      patch.displayName = parsed.data.displayName.trim();
    }
    if (parsed.data.hostRules !== undefined) {
      patch.hostRulesJson = parsed.data.hostRules;
    }

    const [updated] = await db
      .update(devKeysTable)
      .set(patch)
      .where(eq(devKeysTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "API key not found" });
      return;
    }

    res.json({
      id: updated.id,
      apiKeyMasked: maskApiKey(updated.apiKey),
      displayName: updated.displayName,
      status: updated.status,
      internalBalanceLzt: updated.internalBalanceLzt,
      withdrawableBalanceLzt: updated.withdrawableBalanceLzt,
      hostRules: updated.hostRulesJson ?? {},
    });
  },
);

// GET /admin/economy/drips
router.get("/admin/economy/drips", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(dripSchedulesTable)
    .orderBy(desc(dripSchedulesTable.createdAt))
    .limit(100);
  res.json(rows);
});

const createDripSchema = z.object({
  ownerType: z.enum(["player", "host", "dev_key"]),
  ownerTokenOrId: z.string().min(1),
  amountLztPerTick: z.number().int().positive().max(10_000_000),
  interval: z.enum(["daily", "weekly"]),
  ticksTotal: z.number().int().positive().max(1_000_000),
  bucket: z.enum(["balance", "cash"]).optional(),
  note: z.string().max(2000).optional(),
  purchaseUsdtCents: z.number().int().min(0).optional(),
  startAt: z.string().datetime().optional(),
});

router.post(
  "/admin/economy/drips",
  economyWriteLimiter,
  async (req, res): Promise<void> => {
    const parsed = createDripSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const owner = await resolveOwner(
      parsed.data.ownerType,
      parsed.data.ownerTokenOrId,
    );
    if (!owner) {
      res.status(404).json({ error: "Owner not found" });
      return;
    }

    const nextTickAt = parsed.data.startAt
      ? new Date(parsed.data.startAt)
      : new Date();

    const adminHostId = (req as { adminHostId?: string }).adminHostId;
    const [row] = await db
      .insert(dripSchedulesTable)
      .values({
        ownerType: parsed.data.ownerType,
        ownerId: owner.id,
        amountLztPerTick: parsed.data.amountLztPerTick,
        interval: parsed.data.interval,
        ticksTotal: parsed.data.ticksTotal,
        nextTickAt,
        bucket: parsed.data.bucket ?? "balance",
        note: parsed.data.note?.trim() ?? "",
        purchaseUsdtCents: parsed.data.purchaseUsdtCents,
        createdByAdminHostId: adminHostId ?? null,
      })
      .returning();

    res.status(201).json(row);
  },
);

router.patch(
  "/admin/economy/drips/:id",
  economyWriteLimiter,
  async (req, res): Promise<void> => {
    const id = String(req.params.id ?? "").trim();
    const status = req.body?.status;
    if (!["active", "paused", "cancelled"].includes(status)) {
      res.status(400).json({ error: "status must be active | paused | cancelled" });
      return;
    }
    const [updated] = await db
      .update(dripSchedulesTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(dripSchedulesTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Drip schedule not found" });
      return;
    }
    res.json(updated);
  },
);

const adjustmentSchema = z.object({
  ownerType: z.enum(["player", "host", "dev_key"]),
  ownerTokenOrId: z.string().min(1),
  bucket: z.enum(["balance", "cash"]),
  deltaLzt: z.number().int().refine((n) => n !== 0, "deltaLzt must be non-zero"),
  reason: z.string().min(1).max(500),
});

router.post(
  "/admin/economy/adjustments",
  economyWriteLimiter,
  async (req, res): Promise<void> => {
    const parsed = adjustmentSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const owner = await resolveOwner(
      parsed.data.ownerType,
      parsed.data.ownerTokenOrId,
    );
    if (!owner) {
      res.status(404).json({ error: "Owner not found" });
      return;
    }

    const adminHostId = (req as { adminHostId?: string }).adminHostId;
    const delta = parsed.data.deltaLzt;

    try {
      await db.transaction(async (tx) => {
        const ok = await adjustUserBucket(
          tx,
          parsed.data.ownerType,
          owner.id,
          parsed.data.bucket,
          delta,
        );
        if (!ok) {
          throw Object.assign(new Error("insufficient_balance"), {
            code: "insufficient_balance",
          });
        }
        const groupId = randomUUID();
        await writeLedger(tx, [
          {
            groupId,
            kind: "admin_adjustment",
            ownerType: parsed.data.ownerType,
            ownerId: owner.id,
            bucket: parsed.data.bucket,
            deltaLzt: delta,
            refType: "admin_host",
            refId: adminHostId ?? null,
            note: parsed.data.reason,
          },
        ]);
      });
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: string }).code === "insufficient_balance"
      ) {
        res.status(400).json({ error: "Insufficient balance for debit" });
        return;
      }
      throw err;
    }

    res.json({ ok: true });
  },
);

router.get("/admin/economy/adjustments", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(ledgerTable)
    .where(
      inArray(ledgerTable.kind, [
        "admin_adjustment",
        "admin_grant",
        "drip_payout",
      ]),
    )
    .orderBy(desc(ledgerTable.createdAt))
    .limit(50);
  res.json(rows);
});

const marathonTaskSchema = z.object({
  taskTitle: z.string().min(1).max(500),
  wave: z.string().max(20).optional(),
});

router.post(
  "/admin/economy/marathon-task",
  economyWriteLimiter,
  async (req, res): Promise<void> => {
    const parsed = marathonTaskSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const webhook = process.env.CURSOR_AUTOMATION_WEBHOOK_URL?.trim();
    if (webhook) {
      try {
        const resp = await fetch(webhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task: parsed.data.taskTitle,
            wave: parsed.data.wave ?? "backlog",
            source: "admin-economy",
          }),
        });
        if (!resp.ok) {
          res.status(502).json({
            error: "webhook_failed",
            status: resp.status,
          });
          return;
        }
        res.json({ ok: true, channel: "webhook" });
        return;
      } catch (err) {
        req.log.error({ err }, "Marathon webhook failed");
        res.status(502).json({ error: "webhook_error" });
        return;
      }
    }

    const marathonPath = path.resolve(process.cwd(), "MARATHON.md");
    try {
      const content = await fs.readFile(marathonPath, "utf8");
      const wave = parsed.data.wave ?? "Backlog";
      const line = `| ${parsed.data.taskTitle} | ${wave} | pending |`;
      const backlogMarker = "## Backlog";
      let updated: string;
      if (content.includes(backlogMarker)) {
        updated = content.replace(
          backlogMarker,
          `${backlogMarker}\n\n${line}`,
        );
      } else {
        updated = `${content.trimEnd()}\n\n## Backlog\n\n${line}\n`;
      }
      await fs.writeFile(marathonPath, updated, "utf8");
      res.json({ ok: true, channel: "marathon_file" });
    } catch (err) {
      req.log.error({ err }, "Failed to append MARATHON.md");
      res.status(500).json({
        error: "marathon_file_error",
        message: "Set CURSOR_AUTOMATION_WEBHOOK_URL or ensure MARATHON.md is writable",
      });
    }
  },
);

export default router;
