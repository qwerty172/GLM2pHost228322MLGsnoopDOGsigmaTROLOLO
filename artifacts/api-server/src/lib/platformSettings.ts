import { eq } from "drizzle-orm";
import { db, platformSettingsTable, systemAccountsTable } from "@workspace/db";
import { logger } from "./logger";
import {
  SYSTEM_DRIP_RESERVE,
  SYSTEM_INTEREST_RESERVE,
  SYSTEM_PLATFORM_FEES,
} from "./economy";

export type PlatformSettingsSnapshot = {
  weeklyInterestRateHbps: number;
  guestCreditLimitLzt: number;
  defaultCreditLimitLzt: number;
  welcomeBonusLzt: number;
  interestEnabled: boolean;
  updatedAt: Date;
};

const DEFAULTS: PlatformSettingsSnapshot = {
  weeklyInterestRateHbps: Number(process.env["WEEKLY_INTEREST_RATE_HBPS"] ?? 20),
  guestCreditLimitLzt: 500,
  defaultCreditLimitLzt: 3000,
  welcomeBonusLzt: 0,
  interestEnabled: process.env["WEEKLY_INTEREST_ENABLED"] !== "off",
  updatedAt: new Date(0),
};

let cache: PlatformSettingsSnapshot | null = null;
let cacheAt = 0;
const CACHE_MS = 60_000;

export async function ensurePlatformSettingsRow(): Promise<void> {
  await db
    .insert(platformSettingsTable)
    .values({ id: 1 })
    .onConflictDoNothing();
  for (const key of [
    SYSTEM_INTEREST_RESERVE,
    SYSTEM_PLATFORM_FEES,
    SYSTEM_DRIP_RESERVE,
  ]) {
    await db
      .insert(systemAccountsTable)
      .values({ key, balanceLzt: 0 })
      .onConflictDoNothing();
  }
}

export async function getPlatformSettings(
  force = false,
): Promise<PlatformSettingsSnapshot> {
  const now = Date.now();
  if (!force && cache && now - cacheAt < CACHE_MS) return cache;

  await ensurePlatformSettingsRow();
  const [row] = await db
    .select()
    .from(platformSettingsTable)
    .where(eq(platformSettingsTable.id, 1));

  if (!row) {
    cache = { ...DEFAULTS };
    cacheAt = now;
    return cache;
  }

  cache = {
    weeklyInterestRateHbps: row.weeklyInterestRateHbps,
    guestCreditLimitLzt: row.guestCreditLimitLzt,
    defaultCreditLimitLzt: row.defaultCreditLimitLzt,
    welcomeBonusLzt: row.welcomeBonusLzt,
    interestEnabled: row.interestEnabled,
    updatedAt: row.updatedAt,
  };
  cacheAt = now;
  return cache;
}

export function invalidatePlatformSettingsCache(): void {
  cache = null;
  cacheAt = 0;
}

export async function updatePlatformSettings(
  patch: Partial<
    Pick<
      PlatformSettingsSnapshot,
      | "weeklyInterestRateHbps"
      | "guestCreditLimitLzt"
      | "defaultCreditLimitLzt"
      | "welcomeBonusLzt"
      | "interestEnabled"
    >
  >,
): Promise<PlatformSettingsSnapshot> {
  await ensurePlatformSettingsRow();
  const [updated] = await db
    .update(platformSettingsTable)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(platformSettingsTable.id, 1))
    .returning();

  invalidatePlatformSettingsCache();
  if (!updated) {
    logger.warn("platform_settings update returned no row — using defaults");
    return getPlatformSettings(true);
  }

  return getPlatformSettings(true);
}
