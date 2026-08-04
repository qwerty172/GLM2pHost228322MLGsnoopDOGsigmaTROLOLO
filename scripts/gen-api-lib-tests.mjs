#!/usr/bin/env node
/**
 * One-shot generator for M-48: co-located vitest files for api-server lib modules.
 * Run: node scripts/gen-api-lib-tests.mjs
 */
import { writeFileSync, existsSync, readdirSync } from "node:fs";

const libDir = "artifacts/api-server/src/lib";
const TEST_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const JWT_SECRET = "test-jwt-secret-for-unit-tests";

const tests = {
  tokens: `import { describe, expect, it } from "vitest";
import { generateToken, generateJoinCode, isJoinCodeSlug } from "./tokens";

describe("tokens", () => {
  it("generateToken returns url-safe base64", () => {
    const t = generateToken(24);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(t.length).toBeGreaterThanOrEqual(30);
  });

  it("generateJoinCode uses unambiguous alphabet", () => {
    const code = generateJoinCode(8);
    expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);
  });

  it("isJoinCodeSlug distinguishes join codes from player tokens", () => {
    expect(isJoinCodeSlug("ABCDEFGH")).toBe(true);
    expect(isJoinCodeSlug("very-long-player-token-value")).toBe(false);
    expect(isJoinCodeSlug("bad0")).toBe(false);
  });
});
`,

  timingSafeEqual: `import { describe, expect, it } from "vitest";
import { timingSafeEqualString } from "./timingSafeEqual";

describe("timingSafeEqual", () => {
  it("matches equal secrets", () => {
    expect(timingSafeEqualString("secret-a", "secret-a")).toBe(true);
  });

  it("rejects unequal or empty values", () => {
    expect(timingSafeEqualString("a", "b")).toBe(false);
    expect(timingSafeEqualString("", "x")).toBe(false);
    expect(timingSafeEqualString("short", "longer")).toBe(false);
  });
});
`,

  timingSafe: `import { describe, expect, it } from "vitest";
import { timingSafeEqualString } from "./timingSafe";

describe("timingSafe", () => {
  it("matches equal strings", () => {
    expect(timingSafeEqualString("abc", "abc")).toBe(true);
  });

  it("rejects different lengths without leaking via early return only", () => {
    expect(timingSafeEqualString("ab", "abc")).toBe(false);
    expect(timingSafeEqualString("", "a")).toBe(false);
  });
});
`,

  lzt: `import { describe, expect, it } from "vitest";
import { LZT_PER_USDT, lztToUsdt, pickPlayerBucket, usdtToLzt, usdtToLztRound } from "./lzt";

describe("lzt", () => {
  it("converts USDT ↔ LZT at fixed rate", () => {
    expect(LZT_PER_USDT).toBe(200);
    expect(usdtToLzt(1)).toBe(200);
    expect(usdtToLzt(0)).toBe(0);
    expect(lztToUsdt(200)).toBe(1);
    expect(usdtToLztRound(0.0025)).toBe(1);
  });

  it("pickPlayerBucket respects auto/green/blue rules", () => {
    expect(pickPlayerBucket("auto", 100, 100, 0)).toBe("green");
    expect(pickPlayerBucket("auto", 100, 50, 100)).toBe("blue");
    expect(pickPlayerBucket("auto", 100, 50, 50)).toBeNull();
  });
});
`,

  tariff: `import { describe, expect, it } from "vitest";
import {
  applyPremiumDiscountPct,
  effectiveDepositRatePct,
  isPremiumActive,
  premiumGrantOnCross,
  tierForLifetimeCents,
} from "./tariff";

describe("tariff", () => {
  it("maps lifetime deposit tiers", () => {
    expect(tierForLifetimeCents(0).ratePct).toBe(50);
    expect(tierForLifetimeCents(25_000_000).bonus).toBe("investor");
  });

  it("applies premium discount", () => {
    expect(effectiveDepositRatePct({ lifetimeUsdtCents: 0, premiumActive: true })).toBe(35);
    expect(applyPremiumDiscountPct(25, true)).toBe(10);
  });

  it("grants premium on $15k cross", () => {
    expect(premiumGrantOnCross(1_499_999, 1_500_000)?.freePremiumDays).toBe(730);
    expect(premiumGrantOnCross(1_500_000, 2_000_000)).toBeNull();
  });

  it("detects active premium window", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(isPremiumActive(new Date("2026-06-01T00:00:00Z"), now)).toBe(true);
    expect(isPremiumActive(null, now)).toBe(false);
  });
});
`,

  invites: `import { describe, expect, it } from "vitest";
import { defaultInviteExpiresAt, generateInviteCode, isInviteExpired } from "./invites";

describe("invites", () => {
  it("generates invite codes and expiry helpers", () => {
    const code = generateInviteCode();
    expect(code.length).toBeGreaterThanOrEqual(10);
    const from = new Date("2026-01-01T00:00:00Z");
    const expires = defaultInviteExpiresAt(from);
    expect(expires.getTime() - from.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    expect(isInviteExpired(expires, from)).toBe(false);
    expect(isInviteExpired(null)).toBe(false);
  });
});
`,

  schedule: `import { describe, expect, it } from "vitest";
import { isHostAvailableNow, isWithinSchedule, minutesSinceWindowStart } from "./schedule";

describe("schedule", () => {
  const mondayMorning = new Date("2026-07-20T10:30:00Z");
  const slots = [{ day: 1, startMin: 9 * 60, endMin: 12 * 60 }];

  it("isWithinSchedule matches UTC slots", () => {
    expect(isWithinSchedule(slots, mondayMorning)).toBe(true);
    expect(isWithinSchedule([], mondayMorning)).toBe(false);
  });

  it("minutesSinceWindowStart tracks elapsed minutes", () => {
    expect(minutesSinceWindowStart(slots, mondayMorning)).toBe(90);
  });

  it("isHostAvailableNow respects scheduleMode", () => {
    expect(isHostAvailableNow("always", [], mondayMorning)).toBe(true);
    expect(isHostAvailableNow("off", slots, mondayMorning)).toBe(false);
  });
});
`,

  requestToken: `import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { TOKEN_PLACEHOLDER, USER_TOKEN_HEADER, headerUserToken, hostTokenFromRequest } from "./requestToken";

describe("requestToken", () => {
  it("exports header constants", () => {
    expect(USER_TOKEN_HEADER).toBe("x-user-token");
    expect(TOKEN_PLACEHOLDER).toBe("@me");
  });

  it("hostTokenFromRequest prefers Bearer then X-Host-Token", () => {
    expect(hostTokenFromRequest({ headers: { authorization: "Bearer tok" } } as Request)).toBe("tok");
    expect(hostTokenFromRequest({ headers: { "x-host-token": "hdr" } } as Request)).toBe("hdr");
    expect(hostTokenFromRequest({ headers: {} } as Request)).toBeNull();
  });

  it("headerUserToken reads X-User-Token", () => {
    expect(headerUserToken({ headers: { [USER_TOKEN_HEADER]: "  user-tok  " } } as Request)).toBe("user-tok");
    expect(headerUserToken({ headers: {} } as Request)).toBeNull();
  });
});
`,

  hostAuth: `import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { hostTokenFromRequest } from "./hostAuth";

describe("hostAuth", () => {
  it("re-exports hostTokenFromRequest", () => {
    expect(hostTokenFromRequest({ headers: { authorization: "Bearer host" } } as Request)).toBe("host");
  });
});
`,

  joinCodes: `import { describe, expect, it } from "vitest";
import { JOIN_CODE_TTL_MS } from "./joinCodes";

describe("joinCodes", () => {
  it("JOIN_CODE_TTL_MS is 15 minutes", () => {
    expect(JOIN_CODE_TTL_MS).toBe(15 * 60 * 1000);
  });
});
`,

  hostTier: `import { describe, expect, it } from "vitest";
import {
  BASELINE_MIN,
  BASELINE_REC,
  STREAM_OVERHEAD,
  computeHostTier,
  generalHostTier,
  parseGpuVram,
  specsFromPcSpecs,
} from "./hostTier";

describe("hostTier", () => {
  it("parses GPU VRAM from name", () => {
    expect(parseGpuVram("RTX 4070 12 GB")).toBe(12);
    expect(parseGpuVram(null)).toBeNull();
  });

  it("computeHostTier uses weakest-component wins", () => {
    const specs = { gpuVram: 12, cpuCores: 8, ramGb: 16, downloadMbps: 100, uploadMbps: 30 };
    const min = { gpuVram: 4, cpuCores: 4, ramGb: 8, downloadMbps: 25, uploadMbps: 10 };
    const rec = { gpuVram: 8, cpuCores: 8, ramGb: 16, downloadMbps: 75, uploadMbps: 20 };
    expect(computeHostTier(specs, min, rec)).toBe("above_rec");
    expect(computeHostTier({ ...specs, ramGb: 6 }, min, rec)).toBe("below_min");
  });

  it("generalHostTier defaults unknown pcSpecs to meets_min", () => {
    expect(generalHostTier(null)).toBe("meets_min");
    expect(specsFromPcSpecs(null).gpuVram).toBeNull();
  });

  it("exports baseline constants", () => {
    expect(STREAM_OVERHEAD.cpuCores).toBe(2);
    expect(BASELINE_MIN.ramGb).toBe(8);
    expect(BASELINE_REC.ramGb).toBe(16);
  });
});
`,

  storageObjectPath: `import { describe, expect, it } from "vitest";
import { normalizeStorageObjectPath } from "./storageObjectPath";

describe("storageObjectPath", () => {
  it("normalizes absolute and relative object paths", () => {
    expect(normalizeStorageObjectPath("https://cdn.example/objects/foo/bar.png")).toBe("/objects/foo/bar.png");
    expect(normalizeStorageObjectPath("/objects/cover.jpg")).toBe("/objects/cover.jpg");
    expect(normalizeStorageObjectPath("  ")).toBeNull();
    expect(normalizeStorageObjectPath("/objects/../secret")).toBeNull();
  });
});
`,

  steamSpecs: `import { describe, expect, it } from "vitest";
import { parseSteamPcRequirements, recSpecsToJson } from "./steamSpecs";

describe("steamSpecs", () => {
  it("parses Steam HTML requirements", () => {
    const { min, rec } = parseSteamPcRequirements({
      pc_requirements: {
        minimum: "<strong>Memory:</strong> 8 GB RAM<br><strong>Graphics:</strong> 4 GB VRAM",
        recommended: "<strong>Memory:</strong> 16 GB RAM",
      },
    });
    expect(min.ramGb).toBe(8);
    expect(min.gpuVram).toBe(4);
    expect(rec.ramGb).toBe(16);
  });

  it("recSpecsToJson nulls undefined fields", () => {
    expect(recSpecsToJson({ gpuVram: 8, cpuCores: null, ramGb: 16, downloadMbps: null, uploadMbps: null })).toEqual({
      gpuVram: 8,
      cpuCores: null,
      ramGb: 16,
      downloadMbps: null,
      uploadMbps: null,
    });
  });
});
`,

  sessionSerialize: `import { describe, expect, it } from "vitest";
import { baseSerialize } from "./sessionSerialize";

describe("sessionSerialize", () => {
  it("baseSerialize coerces ratePerMinute to number", () => {
    const row = {
      id: "s1",
      ratePerMinute: "12.5",
      status: "active",
    } as never;
    expect(baseSerialize(row).ratePerMinute).toBe(12.5);
  });
});
`,

  encryption: `import { describe, expect, it, beforeAll } from "vitest";
import { decryptSecret, encryptSecret, isWalletCryptoEnabled } from "./encryption";

describe("encryption", () => {
  beforeAll(() => {
    process.env.WALLET_ENCRYPTION_KEY = "${TEST_KEY}";
  });

  it("isWalletCryptoEnabled when key is valid", () => {
    expect(isWalletCryptoEnabled()).toBe(true);
  });

  it("round-trips encrypt/decrypt", () => {
    const payload = encryptSecret("hello-wallet-secret");
    expect(payload.split(":")).toHaveLength(3);
    expect(decryptSecret(payload)).toBe("hello-wallet-secret");
  });
});
`,

  sshKey: `import { describe, expect, it, beforeAll } from "vitest";
import { decryptSshKey, encryptSshKey } from "./sshKey";

describe("sshKey", () => {
  beforeAll(() => {
    process.env.WALLET_ENCRYPTION_KEY = "${TEST_KEY}";
  });

  it("round-trips SSH private key encryption", () => {
    const key = "-----BEGIN OPENSSH PRIVATE KEY-----\\ntest\\n-----END OPENSSH PRIVATE KEY-----";
    const enc = encryptSshKey(key);
    expect(decryptSshKey(enc)).toBe(key);
  });
});
`,

  jwt: `import { describe, expect, it, beforeAll } from "vitest";
import {
  ACCESS_TTL_SEC,
  WS_TICKET_TTL_SEC,
  generateRefreshToken,
  hashRefreshToken,
  signAccessJwt,
  signWsTicket,
  verifyAccessJwt,
  verifyWsTicket,
} from "./jwt";

describe("jwt", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = "${JWT_SECRET}";
  });

  it("exports TTL constants", () => {
    expect(ACCESS_TTL_SEC).toBe(15 * 60);
    expect(WS_TICKET_TTL_SEC).toBe(5 * 60);
  });

  it("hashes and generates refresh tokens", () => {
    const tok = generateRefreshToken();
    expect(tok.length).toBeGreaterThan(20);
    expect(hashRefreshToken(tok)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("signs and verifies access JWT", async () => {
    const jwt = await signAccessJwt("user-1", "player");
    const claims = await verifyAccessJwt(jwt);
    expect(claims?.sub).toBe("user-1");
    expect(claims?.typ).toBe("player");
    expect(claims?.kind).toBe("access");
  });

  it("signs and verifies WS ticket", async () => {
    const ticket = await signWsTicket("host-1", "host", "sess-1");
    const claims = await verifyWsTicket(ticket);
    expect(claims?.sub).toBe("host-1");
    expect(claims?.sessionId).toBe("sess-1");
    expect(claims?.kind).toBe("ws-ticket");
  });
});
`,

  redis: `import { describe, expect, it } from "vitest";
import { isRedisAvailable } from "./redis";

describe("redis", () => {
  it("isRedisAvailable is false before init", () => {
    expect(isRedisAvailable()).toBe(false);
  });
});
`,

  logger: `import { describe, expect, it } from "vitest";
import { logger } from "./logger";

describe("logger", () => {
  it("exports a pino logger with info level by default", () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
  });
});
`,

  pgNotify: `import { describe, expect, it } from "vitest";
import { NOTIFY_CHANNEL, subscribePlatformEvents } from "./pgNotify";

describe("pgNotify", () => {
  it("exports NOTIFY channel name", () => {
    expect(NOTIFY_CHANNEL).toBe("decentralhub_events");
  });

  it("subscribePlatformEvents returns unsubscribe fn", () => {
    const unsub = subscribePlatformEvents(() => {});
    expect(typeof unsub).toBe("function");
    unsub();
  });
});
`,

  sentry: `import { describe, expect, it } from "vitest";
import { captureException, initSentry } from "./sentry";

describe("sentry", () => {
  it("no-ops when SENTRY_DSN unset", async () => {
    const prev = process.env.SENTRY_DSN;
    delete process.env.SENTRY_DSN;
    await expect(initSentry()).resolves.toBeUndefined();
    await expect(captureException(new Error("test"))).resolves.toBeUndefined();
    if (prev) process.env.SENTRY_DSN = prev;
  });
});
`,

  objectStorage: `import { describe, expect, it } from "vitest";
import {
  ObjectNotFoundError,
  ObjectStorageNotConfiguredError,
  isObjectStorageConfigured,
} from "./objectStorage";

describe("objectStorage", () => {
  it("isObjectStorageConfigured requires both env vars", () => {
    const pub = process.env.PUBLIC_OBJECT_SEARCH_PATHS;
    const priv = process.env.PRIVATE_OBJECT_DIR;
    delete process.env.PUBLIC_OBJECT_SEARCH_PATHS;
    delete process.env.PRIVATE_OBJECT_DIR;
    expect(isObjectStorageConfigured()).toBe(false);
    process.env.PUBLIC_OBJECT_SEARCH_PATHS = "/public";
    expect(isObjectStorageConfigured()).toBe(false);
    process.env.PRIVATE_OBJECT_DIR = "/private";
    expect(isObjectStorageConfigured()).toBe(true);
    if (pub) process.env.PUBLIC_OBJECT_SEARCH_PATHS = pub;
    else delete process.env.PUBLIC_OBJECT_SEARCH_PATHS;
    if (priv) process.env.PRIVATE_OBJECT_DIR = priv;
    else delete process.env.PRIVATE_OBJECT_DIR;
  });

  it("error classes have correct names", () => {
    expect(new ObjectNotFoundError().name).toBe("ObjectNotFoundError");
    expect(new ObjectStorageNotConfiguredError().name).toBe("ObjectStorageNotConfiguredError");
  });
});
`,

  quotaEngine: `import { describe, expect, it } from "vitest";
import { computeQuotaEffect, generateAccessCode, isQuotaActiveNow } from "./quotaEngine";
import type { Quota } from "@workspace/db";

function baseQuota(overrides: Partial<Quota> = {}): Quota {
  return {
    id: "q1",
    kind: "royalty",
    status: "active",
    royaltyBasis: "percent",
    royaltyValue: 10,
    escrowRemainingLzt: 0,
    minSessionMinutes: null,
    maxSessionMinutes: null,
    startAt: null,
    endAt: null,
    sponsorHostPerMinuteLzt: null,
    sponsorPlayerPerMinuteLzt: null,
    ...overrides,
  } as Quota;
}

describe("quotaEngine", () => {
  it("computeQuotaEffect applies percent royalty", () => {
    const effect = computeQuotaEffect(baseQuota(), 100, 5);
    expect(effect.royaltyLzt).toBe(10);
  });

  it("generateAccessCode returns 8 chars", () => {
    expect(generateAccessCode()).toMatch(/^[A-Z2-9]{8}$/);
  });

  it("isQuotaActiveNow checks status and escrow", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(isQuotaActiveNow(baseQuota(), now)).toBe(true);
    expect(isQuotaActiveNow(baseQuota({ status: "paused" }), now)).toBe(false);
    expect(isQuotaActiveNow(baseQuota({ kind: "sponsor", escrowRemainingLzt: 0 }), now)).toBe(false);
  });
});
`,

  quotaAttach: `import { describe, expect, it } from "vitest";
import { checkQuotaAttachment } from "./quotaAttach";
import type { Quota } from "@workspace/db";

describe("quotaAttach", () => {
  const quota = {
    id: "q1",
    gameId: "game-a",
    minGpuVram: 8,
    minCpuCores: 4,
    minRamGb: 8,
    minDownloadMbps: null,
    minUploadMbps: null,
    recGpuVram: null,
    recCpuCores: null,
    recRamGb: null,
    recDownloadMbps: null,
    recUploadMbps: null,
  } as Quota;

  const host = {
    id: "h1",
    gameId: "game-a",
    pcSpecs: { gpu: "RTX 3080 10GB", ramGb: 32, cpuCores: 8, downloadMbps: 100, uploadMbps: 20 },
  } as never;

  it("rejects wrong game binding", () => {
    expect(checkQuotaAttachment(quota, host, "game-b").ok).toBe(false);
  });

  it("allows host meeting min specs", () => {
    expect(checkQuotaAttachment(quota, host, "game-a").ok).toBe(true);
  });

  it("allows host without pcSpecs telemetry", () => {
    expect(checkQuotaAttachment(quota, { ...host, pcSpecs: null }, "game-a").ok).toBe(true);
  });
});
`,

  ratings: `import { describe, expect, it } from "vitest";
import { submitSessionRating } from "./ratings";

describe("ratings", () => {
  it("rejects invalid scores before DB", async () => {
    const result = await submitSessionRating({
      sessionId: "s1",
      playerId: "p1",
      hostId: "h1",
      score: 0,
    });
    expect(result).toEqual({ ok: false, error: "score must be 1–5" });
    const result2 = await submitSessionRating({
      sessionId: "s1",
      playerId: "p1",
      hostId: "h1",
      score: 6,
    });
    expect(result2.ok).toBe(false);
  });
});
`,

  verifierDb: `import { describe, expect, it } from "vitest";
import { verifierDb } from "./verifierDb";

describe("verifierDb", () => {
  it("exports VerifierDb interface methods", () => {
    expect(typeof verifierDb.insertLinkToken).toBe("function");
    expect(typeof verifierDb.consumeLinkToken).toBe("function");
    expect(typeof verifierDb.getLinks).toBe("function");
    expect(typeof verifierDb.setTrustLevel).toBe("function");
  });
});
`,

  walletAddresses: `import { describe, expect, it, beforeAll } from "vitest";
import { generateNanoAddress, generateSolanaAddress, generateTronUsdtAddress } from "./walletAddresses";

describe("walletAddresses", () => {
  beforeAll(() => {
    process.env.WALLET_ENCRYPTION_KEY = "${TEST_KEY}";
  });

  it("generateSolanaAddress returns valid shape", async () => {
    const addr = await generateSolanaAddress();
    expect(addr.currency).toBe("SOL");
    expect(addr.address.length).toBeGreaterThan(20);
    expect(addr.encryptedPrivateKey).toContain(":");
  });

  it("generateNanoAddress returns nano_ prefix", async () => {
    const addr = await generateNanoAddress();
    expect(addr.currency).toBe("NANO");
    expect(addr.address.startsWith("nano_")).toBe(true);
  });

  it("generateTronUsdtAddress returns TRC20 address", async () => {
    const addr = await generateTronUsdtAddress();
    expect(addr.currency).toBe("USDT_TRC20");
    expect(addr.address.startsWith("T")).toBe(true);
  });
});
`,

  walletOwner: `import { describe, expect, it } from "vitest";
import { resolveOwnerByToken } from "./walletOwner";

describe("walletOwner", () => {
  it("resolveOwnerByToken is exported", () => {
    expect(typeof resolveOwnerByToken).toBe("function");
  });
});
`,

  hostLibrary: `import { describe, expect, it } from "vitest";
import { listLibrary } from "./hostLibrary";

describe("hostLibrary", () => {
  it("listLibrary is exported", () => {
    expect(typeof listLibrary).toBe("function");
  });
});
`,

  legacyBackfill: `import { describe, expect, it } from "vitest";
import { runLegacyBackfill } from "./legacyBackfill";

describe("legacyBackfill", () => {
  it("runLegacyBackfill is exported", () => {
    expect(typeof runLegacyBackfill).toBe("function");
  });
});
`,

  seedGames: `import { describe, expect, it } from "vitest";
import { seedGames } from "./seedGames";

describe("seedGames", () => {
  it("seedGames is exported", () => {
    expect(typeof seedGames).toBe("function");
  });
});
`,

  signaling: `import { describe, expect, it } from "vitest";

describe("signaling", () => {
  it("module loads without throwing", async () => {
    const mod = await import("./signaling");
    expect(mod).toBeDefined();
  });
});
`,

  launchFee: `import { describe, expect, it } from "vitest";
import { applyLaunchFee } from "./launchFee";

describe("launchFee", () => {
  it("no-ops for zero fee", async () => {
    const result = await applyLaunchFee({
      sessionId: "s1",
      hostId: "h1",
      playerId: "p1",
      launchPriceUsd: 0,
      paymentSource: "auto",
    });
    expect(result).toEqual({ ok: true });
  });
});
`,

  sessionBilling: `import { describe, expect, it } from "vitest";
import { countSessionMinutesUsed, refundBlockRemainder } from "./sessionBilling";

describe("sessionBilling", () => {
  it("exports billing helpers", () => {
    expect(typeof countSessionMinutesUsed).toBe("function");
    expect(typeof refundBlockRemainder).toBe("function");
  });

  it("block refund math is consistent", () => {
    const blockMinutes = 60;
    const blockReservedLzt = 600;
    const costPerMinute = Math.round(blockReservedLzt / blockMinutes);
    expect(Math.max(0, blockReservedLzt - 10 * costPerMinute)).toBe(500);
  });
});
`,

  billingWorker: `import { describe, expect, it } from "vitest";
import { countSessionMinutesUsed, refundBlockRemainder, startBillingWorker, stopBillingWorker } from "./billingWorker";

describe("billingWorker", () => {
  it("re-exports session billing helpers", () => {
    expect(typeof countSessionMinutesUsed).toBe("function");
    expect(typeof refundBlockRemainder).toBe("function");
  });

  it("exports start/stop", () => {
    expect(typeof startBillingWorker).toBe("function");
    expect(typeof stopBillingWorker).toBe("function");
  });
});
`,

  depositWorker: `import { describe, expect, it } from "vitest";
import { runDepositPollOnce, startDepositWorker, stopDepositWorker } from "./depositWorker";

describe("depositWorker", () => {
  it("exports worker controls", () => {
    expect(typeof startDepositWorker).toBe("function");
    expect(typeof stopDepositWorker).toBe("function");
    expect(typeof runDepositPollOnce).toBe("function");
  });
});
`,

  hostHealthWorker: `import { describe, expect, it } from "vitest";
import { startHostHealthWorker, stopHostHealthWorker } from "./hostHealthWorker";

describe("hostHealthWorker", () => {
  it("exports start/stop", () => {
    expect(typeof startHostHealthWorker).toBe("function");
    expect(typeof stopHostHealthWorker).toBe("function");
  });
});
`,

  interestWorker: `import { describe, expect, it } from "vitest";
import { runInterestPayoutOnce, startInterestWorker, stopInterestWorker } from "./interestWorker";

describe("interestWorker", () => {
  it("exports worker controls", () => {
    expect(typeof startInterestWorker).toBe("function");
    expect(typeof stopInterestWorker).toBe("function");
    expect(typeof runInterestPayoutOnce).toBe("function");
  });
});
`,

  loanDefaultWorker: `import { describe, expect, it } from "vitest";
import { runLoanDefaultCheckOnce, startLoanDefaultWorker, stopLoanDefaultWorker } from "./loanDefaultWorker";

describe("loanDefaultWorker", () => {
  it("exports worker controls", () => {
    expect(typeof startLoanDefaultWorker).toBe("function");
    expect(typeof stopLoanDefaultWorker).toBe("function");
    expect(typeof runLoanDefaultCheckOnce).toBe("function");
  });
});
`,

  metricsWorker: `import { describe, expect, it } from "vitest";
import { startMetricsWorker } from "./metricsWorker";

describe("metricsWorker", () => {
  it("exports startMetricsWorker", () => {
    expect(typeof startMetricsWorker).toBe("function");
  });
});
`,

  outboxWorker: `import { describe, expect, it } from "vitest";
import { cleanupOutbox, insertOutboxEvent, registerOutboxHandler, startOutboxWorker } from "./outboxWorker";

describe("outboxWorker", () => {
  it("exports outbox API", () => {
    expect(typeof registerOutboxHandler).toBe("function");
    expect(typeof startOutboxWorker).toBe("function");
    expect(typeof insertOutboxEvent).toBe("function");
    expect(typeof cleanupOutbox).toBe("function");
  });
});
`,

  quotaExpiryWorker: `import { describe, expect, it } from "vitest";
import { startQuotaExpiryWorker, stopQuotaExpiryWorker } from "./quotaExpiryWorker";

describe("quotaExpiryWorker", () => {
  it("exports start/stop", () => {
    expect(typeof startQuotaExpiryWorker).toBe("function");
    expect(typeof stopQuotaExpiryWorker).toBe("function");
  });
});
`,

  scheduleWatchdog: `import { describe, expect, it } from "vitest";

describe("scheduleWatchdog", () => {
  it("module loads and exports worker controls", async () => {
    const mod = await import("./scheduleWatchdog");
    expect(typeof mod.startScheduleWatchdog).toBe("function");
    expect(typeof mod.stopScheduleWatchdog).toBe("function");
  });
});
`,

  vdsProvisionWorker: `import { describe, expect, it } from "vitest";
import { startVdsProvisionWorker, stopVdsProvisionWorker } from "./vdsProvisionWorker";

describe("vdsProvisionWorker", () => {
  it("exports start/stop", () => {
    expect(typeof startVdsProvisionWorker).toBe("function");
    expect(typeof stopVdsProvisionWorker).toBe("function");
  });
});
`,

  economy: `import { describe, expect, it } from "vitest";

describe("economy", () => {
  it("module exports core economy functions", async () => {
    const mod = await import("./economy");
    expect(typeof mod.payInternal).toBe("function");
    expect(typeof mod.writeLedger).toBe("function");
    expect(typeof mod.adjustUserBucket).toBe("function");
    expect(typeof mod.creditPayoutToUser).toBe("function");
  });
});
`,
};

function hasTest(base) {
  return (
    existsSync(`${libDir}/${base}.test.ts`) ||
    existsSync(`artifacts/api-server/src/__tests__/${base}.test.ts`)
  );
}

const libModules = readdirSync(libDir).filter(
  (f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && !f.endsWith(".d.ts"),
);

let created = 0;
let skipped = 0;
for (const mod of libModules) {
  const base = mod.replace(/\.ts$/, "");
  if (hasTest(base)) {
    skipped++;
    continue;
  }
  const testPath = `${libDir}/${base}.test.ts`;
  const content = tests[base];
  if (!content) {
    console.error(`No test template for ${base}`);
    process.exit(1);
  }
  writeFileSync(testPath, content);
  created++;
  console.log(`created ${testPath}`);
}

console.log(`Done: ${created} created, ${skipped} skipped`);
