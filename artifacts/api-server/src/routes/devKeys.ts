import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { eq } from "drizzle-orm";
import { db, devKeysTable } from "@workspace/db";
import { generateToken } from "../lib/tokens";
import { ensureDepositAddressesForOwner } from "../lib/walletOwner";
import { rateLimit, ipKey } from "../lib/rateLimit";
import { authorizeDevKeyCreate } from "../lib/devKeyAuth";

const router: IRouter = Router();

const hostRulesSchema = z
  .object({
    maxPricePerMinuteLzt: z.number().int().nonnegative().optional(),
    tags: z.array(z.string().min(1)).max(20).optional(),
  })
  .strict();

const createDevKeyLimiter = rateLimit({
  scope: "dev-keys:create",
  windowMs: 60 * 60_000,
  max: 5,
  keyFn: ipKey,
});

// POST /dev-keys — mint a new API key + LZT wallet for a third-party developer.
router.post("/dev-keys", createDevKeyLimiter, async (req, res): Promise<void> => {
  const auth = await authorizeDevKeyCreate(req);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  const bodySchema = z.object({
    displayName: z.string().max(200).optional(),
    hostRules: hostRulesSchema.optional(),
  });
  const parsed = bodySchema.safeParse(req.body ?? {});
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

  const addresses = await ensureDepositAddressesForOwner("dev_key", created.id);

  req.log.info({ devKeyId: created.id }, "Dev key created");
  res.status(201).json({
    apiKey: created.apiKey,
    displayName: created.displayName,
    status: created.status,
    hostRules: created.hostRulesJson ?? {},
    internalBalanceLzt: created.internalBalanceLzt,
    withdrawableBalanceLzt: created.withdrawableBalanceLzt,
    depositAddresses: addresses.map((a) => ({
      currency: a.currency,
      label: a.label,
      address: a.address,
      network: a.network,
      minDeposit: Number(a.minDeposit),
    })),
    createdAt: created.createdAt,
  });
});

// PATCH /dev-keys/:apiKey/rules — update host-selection rules / status.
router.patch("/dev-keys/:apiKey/rules", async (req, res): Promise<void> => {
  const auth = await authorizeDevKeyCreate(req);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  const paramsSchema = z.object({ apiKey: z.string().min(1) });
  const params = paramsSchema.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const bodySchema = z.object({
    hostRules: hostRulesSchema.optional(),
    status: z.enum(["active", "disabled"]).optional(),
    displayName: z.string().max(200).optional(),
  });
  const body = bodySchema.safeParse(req.body ?? {});
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(devKeysTable)
    .where(eq(devKeysTable.apiKey, params.data.apiKey));
  if (!existing) {
    res.status(404).json({ error: "API key not found" });
    return;
  }

  const patch: Partial<typeof devKeysTable.$inferInsert> = {};
  if (body.data.hostRules !== undefined) patch.hostRulesJson = body.data.hostRules;
  if (body.data.status !== undefined) patch.status = body.data.status;
  if (body.data.displayName !== undefined) {
    patch.displayName = body.data.displayName.trim();
  }

  const [updated] = await db
    .update(devKeysTable)
    .set(patch)
    .where(eq(devKeysTable.id, existing.id))
    .returning();

  res.json({
    apiKey: updated!.apiKey,
    displayName: updated!.displayName,
    status: updated!.status,
    hostRules: updated!.hostRulesJson ?? {},
  });
});

export default router;
