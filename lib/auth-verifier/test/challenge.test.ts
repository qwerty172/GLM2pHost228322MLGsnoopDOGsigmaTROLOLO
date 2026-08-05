import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import {
  createChallenge,
  submitCode,
  getChallengeStatus,
} from "../src/challenge.ts";
import type {
  ProviderName,
  UserType,
  VerifierConfig,
  VerifierDb,
  OtpProvider,
} from "../src/types.ts";

const USER_ID = "user-1";
const USER_TYPE: UserType = "host";
const CHALLENGE_ID = "550e8400-e29b-41d4-a716-446655440000";

function makeLinks(providers: ProviderName[] = ["telegram", "discord"]) {
  return providers.map((provider, i) => ({
    provider,
    providerUserId: `${provider}-uid-${i}`,
    providerUsername: `${provider}_user`,
  }));
}

function makeChallengeRow(
  overrides: {
    codes?: Record<ProviderName, string>;
    verifiedProviders?: ProviderName[];
    expiresAt?: Date;
    completedAt?: Date | null;
    purpose?: string;
  } = {},
) {
  return {
    userId: USER_ID,
    userType: USER_TYPE,
    purpose: overrides.purpose ?? "sensitive_action",
    codes: overrides.codes ?? { telegram: "111111", discord: "222222" },
    verifiedProviders: overrides.verifiedProviders ?? [],
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 60_000),
    completedAt: overrides.completedAt ?? null,
  };
}

function makeDb(overrides: Partial<VerifierDb> = {}): VerifierDb {
  return {
    insertLinkToken: mock.fn(async () => undefined),
    consumeLinkToken: mock.fn(async () => null),
    upsertLink: mock.fn(async () => undefined),
    getLinks: mock.fn(async () => makeLinks()),
    insertChallenge: mock.fn(async () => undefined),
    getChallenge: mock.fn(async () => null),
    markProviderVerified: mock.fn(async () => [] as ProviderName[]),
    completeChallenge: mock.fn(async () => undefined),
    setTrustLevel: mock.fn(async () => undefined),
    ...overrides,
  };
}

function makeProviders(): OtpProvider[] {
  return [
    { name: "telegram", sendOtp: mock.fn(async () => undefined) },
    { name: "discord", sendOtp: mock.fn(async () => undefined) },
  ];
}

function makeCfg(
  db: VerifierDb,
  providers = makeProviders(),
): VerifierConfig {
  return { db, providers, otpTtlSec: 300 };
}

describe("createChallenge", () => {
  it("throws when user has fewer than 2 linked providers", async () => {
    const db = makeDb({
      getLinks: mock.fn(async () => makeLinks(["telegram"])),
    });
    await assert.rejects(
      () =>
        createChallenge(makeCfg(db), USER_ID, USER_TYPE, "sensitive_action"),
      /Need at least 2 linked providers/,
    );
  });

  it("inserts challenge and sends OTPs to all linked providers", async () => {
    const db = makeDb();
    const providers = makeProviders();
    const cfg = makeCfg(db, providers);

    const result = await createChallenge(
      cfg,
      USER_ID,
      USER_TYPE,
      "sensitive_action",
    );

    assert.match(
      result.challengeId,
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    assert.deepEqual(result.providers, ["telegram", "discord"]);
    assert.equal((db.insertChallenge as ReturnType<typeof mock.fn>).mock.calls.length, 1);
    const inserted = (db.insertChallenge as ReturnType<typeof mock.fn>).mock
      .calls[0]!.arguments[0];
    assert.equal(inserted.userId, USER_ID);
    assert.equal(inserted.userType, USER_TYPE);
    assert.equal(inserted.purpose, "sensitive_action");
    assert.match(inserted.codes.telegram, /^\d{6}$/);
    assert.match(inserted.codes.discord, /^\d{6}$/);
    assert.equal(
      (providers[0]!.sendOtp as ReturnType<typeof mock.fn>).mock.calls[0]!
        .arguments[0],
      "telegram-uid-0",
    );
    assert.equal(
      (providers[0]!.sendOtp as ReturnType<typeof mock.fn>).mock.calls[0]!
        .arguments[1],
      inserted.codes.telegram,
    );
    assert.equal(
      (providers[1]!.sendOtp as ReturnType<typeof mock.fn>).mock.calls[0]!
        .arguments[0],
      "discord-uid-1",
    );
    assert.equal(
      (providers[1]!.sendOtp as ReturnType<typeof mock.fn>).mock.calls[0]!
        .arguments[1],
      inserted.codes.discord,
    );
  });
});

describe("submitCode", () => {
  let db: VerifierDb;
  let cfg: VerifierConfig;

  beforeEach(() => {
    db = makeDb();
    cfg = makeCfg(db);
  });

  it("returns expired when challenge is unknown", async () => {
    const result = await submitCode(cfg, CHALLENGE_ID, "telegram", "111111");
    assert.deepEqual(result, { ok: false, status: { state: "expired" } });
  });

  it("returns complete when challenge is already finished", async () => {
    db.getChallenge = mock.fn(async () =>
      makeChallengeRow({ completedAt: new Date() }),
    );
    const result = await submitCode(cfg, CHALLENGE_ID, "telegram", "111111");
    assert.deepEqual(result, { ok: true, status: { state: "complete" } });
  });

  it("returns expired when challenge TTL has passed", async () => {
    db.getChallenge = mock.fn(async () =>
      makeChallengeRow({ expiresAt: new Date(Date.now() - 1_000) }),
    );
    const result = await submitCode(cfg, CHALLENGE_ID, "telegram", "111111");
    assert.deepEqual(result, { ok: false, status: { state: "expired" } });
  });

  it("rejects unknown provider code", async () => {
    db.getChallenge = mock.fn(async () => makeChallengeRow());
    const result = await submitCode(cfg, CHALLENGE_ID, "telegram", "999999");
    assert.equal(result.ok, false);
    assert.deepEqual(result.status, {
      state: "pending",
      verifiedProviders: [],
      remaining: ["telegram", "discord"],
    });
  });

  it("rejects wrong OTP for a known provider", async () => {
    db.getChallenge = mock.fn(async () => makeChallengeRow());
    const result = await submitCode(cfg, CHALLENGE_ID, "telegram", "000000");
    assert.equal(result.ok, false);
    assert.equal(
      (result.status as { state: string }).state,
      "pending",
    );
  });

  it("accepts OTP with whitespace stripped", async () => {
    db.getChallenge = mock.fn(async () => makeChallengeRow());
    db.markProviderVerified = mock.fn(async () => ["telegram"]);
    const result = await submitCode(
      cfg,
      CHALLENGE_ID,
      "telegram",
      " 111 111 ",
    );
    assert.equal(result.ok, true);
    assert.deepEqual(result.status, {
      state: "pending",
      verifiedProviders: ["telegram"],
      remaining: ["discord"],
    });
  });

  it("returns pending after first provider is verified", async () => {
    db.getChallenge = mock.fn(async () => makeChallengeRow());
    db.markProviderVerified = mock.fn(async () => ["telegram"]);
    const result = await submitCode(cfg, CHALLENGE_ID, "telegram", "111111");
    assert.deepEqual(result, {
      ok: true,
      status: {
        state: "pending",
        verifiedProviders: ["telegram"],
        remaining: ["discord"],
      },
    });
    assert.equal((db.completeChallenge as ReturnType<typeof mock.fn>).mock.calls.length, 0);
  });

  it("completes challenge when all providers are verified", async () => {
    db.getChallenge = mock.fn(async () =>
      makeChallengeRow({ verifiedProviders: ["telegram"] }),
    );
    db.markProviderVerified = mock.fn(async () => ["telegram", "discord"]);
    const result = await submitCode(cfg, CHALLENGE_ID, "discord", "222222");
    assert.deepEqual(result, { ok: true, status: { state: "complete" } });
    assert.equal((db.completeChallenge as ReturnType<typeof mock.fn>).mock.calls.length, 1);
    assert.equal(
      (db.completeChallenge as ReturnType<typeof mock.fn>).mock.calls[0]!
        .arguments[0],
      CHALLENGE_ID,
    );
    assert.equal((db.setTrustLevel as ReturnType<typeof mock.fn>).mock.calls.length, 0);
  });

  it("elevates trust level for link_elevation purpose", async () => {
    db.getChallenge = mock.fn(async () =>
      makeChallengeRow({
        purpose: "link_elevation",
        verifiedProviders: ["telegram"],
      }),
    );
    db.markProviderVerified = mock.fn(async () => ["telegram", "discord"]);
    const result = await submitCode(cfg, CHALLENGE_ID, "discord", "222222");
    assert.deepEqual(result.status, { state: "complete" });
    assert.deepEqual(
      (db.setTrustLevel as ReturnType<typeof mock.fn>).mock.calls[0]!.arguments,
      [USER_ID, USER_TYPE, 1],
    );
  });
});

describe("getChallengeStatus", () => {
  it("returns expired for unknown challenge", async () => {
    const db = makeDb();
    const status = await getChallengeStatus(makeCfg(db), CHALLENGE_ID);
    assert.deepEqual(status, { state: "expired" });
  });

  it("returns complete for finished challenge", async () => {
    const db = makeDb({
      getChallenge: mock.fn(async () =>
        makeChallengeRow({ completedAt: new Date() }),
      ),
    });
    const status = await getChallengeStatus(makeCfg(db), CHALLENGE_ID);
    assert.deepEqual(status, { state: "complete" });
  });

  it("returns expired for past TTL", async () => {
    const db = makeDb({
      getChallenge: mock.fn(async () =>
        makeChallengeRow({ expiresAt: new Date(Date.now() - 1_000) }),
      ),
    });
    const status = await getChallengeStatus(makeCfg(db), CHALLENGE_ID);
    assert.deepEqual(status, { state: "expired" });
  });

  it("returns pending with verified and remaining providers", async () => {
    const db = makeDb({
      getChallenge: mock.fn(async () =>
        makeChallengeRow({ verifiedProviders: ["telegram"] }),
      ),
    });
    const status = await getChallengeStatus(makeCfg(db), CHALLENGE_ID);
    assert.deepEqual(status, {
      state: "pending",
      verifiedProviders: ["telegram"],
      remaining: ["discord"],
    });
  });
});
