import { eq } from "drizzle-orm";
import {
  db,
  hostsTable,
  playersTable,
  devKeysTable,
  depositAddressesTable,
} from "@workspace/db";
import { generateAllDepositAddresses } from "./walletAddresses";
import { logger } from "./logger";

export type OwnerType = "host" | "player" | "dev_key";

export interface OwnerRecord {
  id: string;
  type: OwnerType;
  displayName: string;
  internalBalanceLzt: number;
  withdrawableBalanceLzt: number;
  creditLimitLzt: number;
  creditDebtLzt: number;
  creditReceivableLzt: number;
  lifetimeDepositUsdtCents: number;
  premiumUntil: Date | null;
  token: string;
  createdAt: Date;
}

export async function resolveOwnerByToken(
  token: string,
): Promise<OwnerRecord | null> {
  const [host] = await db
    .select()
    .from(hostsTable)
    .where(eq(hostsTable.hostToken, token));
  if (host) {
    return {
      id: host.id,
      type: "host",
      displayName: host.displayName,
      internalBalanceLzt: host.internalBalanceLzt,
      withdrawableBalanceLzt: host.withdrawableBalanceLzt,
      creditLimitLzt: 0,
      creditDebtLzt: host.creditDebtLzt,
      creditReceivableLzt: host.creditReceivableLzt,
      lifetimeDepositUsdtCents: host.lifetimeDepositUsdtCents,
      premiumUntil: host.premiumUntil ?? null,
      token: host.hostToken,
      createdAt: host.createdAt,
    };
  }
  const [player] = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.playerToken, token));
  if (player) {
    return {
      id: player.id,
      type: "player",
      displayName: player.displayName,
      internalBalanceLzt: player.internalBalanceLzt,
      withdrawableBalanceLzt: player.withdrawableBalanceLzt,
      creditLimitLzt: player.creditLimitLzt,
      creditDebtLzt: player.creditDebtLzt,
      creditReceivableLzt: player.creditReceivableLzt,
      lifetimeDepositUsdtCents: player.lifetimeDepositUsdtCents,
      premiumUntil: player.premiumUntil ?? null,
      token: player.playerToken,
      createdAt: player.createdAt,
    };
  }
  const [devKey] = await db
    .select()
    .from(devKeysTable)
    .where(eq(devKeysTable.apiKey, token));
  if (devKey) {
    return {
      id: devKey.id,
      type: "dev_key",
      displayName: devKey.displayName || "Developer key",
      internalBalanceLzt: devKey.internalBalanceLzt,
      withdrawableBalanceLzt: devKey.withdrawableBalanceLzt,
      creditLimitLzt: 0,
      creditDebtLzt: devKey.creditDebtLzt,
      creditReceivableLzt: devKey.creditReceivableLzt,
      lifetimeDepositUsdtCents: devKey.lifetimeDepositUsdtCents,
      premiumUntil: null,
      token: devKey.apiKey,
      createdAt: devKey.createdAt,
    };
  }
  return null;
}

export async function ensureDepositAddressesForOwner(
  ownerType: OwnerType,
  ownerId: string,
): Promise<typeof depositAddressesTable.$inferSelect[]> {
  const existing = await db
    .select()
    .from(depositAddressesTable)
    .where(eq(depositAddressesTable.ownerId, ownerId));
  const existingForOwner = existing.filter((e) => e.ownerType === ownerType);
  if (existingForOwner.length >= 3) {
    return existingForOwner;
  }
  const haveCurrencies = new Set(existingForOwner.map((e) => e.currency));
  let generated;
  try {
    generated = await generateAllDepositAddresses();
  } catch (err) {
    logger.error({ err }, "Failed to generate deposit addresses");
    return existingForOwner;
  }
  const toCreate = generated.filter((g) => !haveCurrencies.has(g.currency));
  if (toCreate.length > 0) {
    await db
      .insert(depositAddressesTable)
      .values(
        toCreate.map((g) => ({
          ownerType,
          ownerId,
          currency: g.currency,
          label: g.label,
          network: g.network,
          address: g.address,
          encryptedPrivateKey: g.encryptedPrivateKey,
          minDeposit: g.minDeposit,
        })),
      )
      .onConflictDoNothing({
        target: [
          depositAddressesTable.ownerType,
          depositAddressesTable.ownerId,
          depositAddressesTable.currency,
        ],
      });
  }
  const refreshed = await db
    .select()
    .from(depositAddressesTable)
    .where(eq(depositAddressesTable.ownerId, ownerId));
  return refreshed.filter((e) => e.ownerType === ownerType);
}
