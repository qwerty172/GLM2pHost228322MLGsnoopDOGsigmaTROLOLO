import { eq } from "drizzle-orm";
import {
  db,
  hostsTable,
  playersTable,
  depositAddressesTable,
} from "@workspace/db";
import { generateAllDepositAddresses } from "./walletAddresses";
import { logger } from "./logger";

export type OwnerType = "host" | "player";

export interface OwnerRecord {
  id: string;
  type: OwnerType;
  displayName: string;
  creditBalance: string;
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
      creditBalance: host.creditBalance,
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
      creditBalance: player.creditBalance,
      token: player.playerToken,
      createdAt: player.createdAt,
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
