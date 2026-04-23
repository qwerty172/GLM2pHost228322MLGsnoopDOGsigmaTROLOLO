import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, playersTable } from "@workspace/db";
import {
  RegisterPlayerBody,
  GetPlayerResponse,
  GetPlayerParams,
} from "@workspace/api-zod";
import { generateToken } from "../lib/tokens";
import { ensureDepositAddressesForOwner } from "../lib/walletOwner";

const router: IRouter = Router();

function serialize(p: typeof playersTable.$inferSelect) {
  return {
    ...p,
    creditBalance: Number(p.creditBalance),
  };
}

router.post("/players/register", async (req, res): Promise<void> => {
  const parsed = RegisterPlayerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const playerToken = generateToken();
  const [player] = await db
    .insert(playersTable)
    .values({
      playerToken,
      displayName: parsed.data.displayName,
    })
    .returning();

  if (!player) {
    res.status(500).json({ error: "Failed to create player" });
    return;
  }

  // Best-effort: pre-generate deposit addresses so the wallet UI is populated
  // immediately. Errors are logged inside the helper and don't block register.
  await ensureDepositAddressesForOwner("player", player.id);

  req.log.info({ playerId: player.id }, "Player registered");
  res.status(201).json(GetPlayerResponse.parse(serialize(player)));
});

router.get("/players/:playerToken", async (req, res): Promise<void> => {
  const params = GetPlayerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [player] = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.playerToken, params.data.playerToken));

  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  res.json(GetPlayerResponse.parse(serialize(player)));
});

export default router;
