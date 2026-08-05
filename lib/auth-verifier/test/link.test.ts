import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import {
  startLinkFlow,
  confirmLinkToken,
  generateLinkToken,
  LINK_TOKEN_LENGTH,
} from "../src/link.ts";
import type {
  ProviderName,
  UserType,
  VerifierConfig,
  VerifierDb,
} from "../src/types.ts";

const USER_ID = "user-1";
const USER_TYPE: UserType = "host";
const PROVIDER: ProviderName = "telegram";

function makeDb(overrides: Partial<VerifierDb> = {}): VerifierDb {
  return {
    insertLinkToken: mock.fn(async () => undefined),
    consumeLinkToken: mock.fn(async () => null),
    upsertLink: mock.fn(async () => undefined),
    getLinks: mock.fn(async () => []),
    insertChallenge: mock.fn(async () => undefined),
    getChallenge: mock.fn(async () => null),
    markProviderVerified: mock.fn(async () => [] as ProviderName[]),
    completeChallenge: mock.fn(async () => undefined),
    setTrustLevel: mock.fn(async () => undefined),
    ...overrides,
  };
}

function makeCfg(
  db: VerifierDb,
  overrides: Partial<VerifierConfig> = {},
): VerifierConfig {
  return {
    db,
    providers: [],
    ...overrides,
  };
}

describe("generateLinkToken", () => {
  // Regression guard: the token used to come from base64url, which can emit
  // `-` and `_`. That broke the API contract (uppercase alphanumeric) roughly
  // one run in N — a flaky failure instead of an honest one.
  it("only ever produces uppercase alphanumeric characters", () => {
    for (let i = 0; i < 500; i++) {
      assert.match(generateLinkToken(), /^[A-Z0-9]{8}$/);
    }
  });

  it("excludes characters that are easy to misread (I, L, O, U)", () => {
    for (let i = 0; i < 500; i++) {
      assert.doesNotMatch(generateLinkToken(), /[ILOU]/);
    }
  });

  it("honours a custom length", () => {
    assert.equal(generateLinkToken(4).length, 4);
    assert.equal(generateLinkToken().length, LINK_TOKEN_LENGTH);
  });

  it("does not repeat itself across calls", () => {
    const seen = new Set(Array.from({ length: 50 }, () => generateLinkToken()));
    assert.equal(seen.size, 50);
  });
});

describe("startLinkFlow", () => {
  it("generates an 8-char uppercase token and inserts with default TTL", async () => {
    const db = makeDb();
    const before = Date.now();
    const result = await startLinkFlow(makeCfg(db), USER_ID, USER_TYPE, PROVIDER);

    assert.equal(result.token.length, LINK_TOKEN_LENGTH);
    assert.match(result.token, /^[A-Z0-9]{8}$/);
    assert.equal(result.expiresIn, 600);
    assert.equal(
      (db.insertLinkToken as ReturnType<typeof mock.fn>).mock.calls.length,
      1,
    );
    const inserted = (db.insertLinkToken as ReturnType<typeof mock.fn>).mock
      .calls[0]!.arguments[0];
    assert.equal(inserted.token, result.token);
    assert.equal(inserted.userId, USER_ID);
    assert.equal(inserted.userType, USER_TYPE);
    assert.equal(inserted.provider, PROVIDER);
    const expiresMs = inserted.expiresAt.getTime() - before;
    assert.ok(expiresMs >= 599_000 && expiresMs <= 601_000);
  });

  it("uses custom linkTtlSec from config", async () => {
    const db = makeDb();
    const result = await startLinkFlow(
      makeCfg(db, { linkTtlSec: 120 }),
      USER_ID,
      USER_TYPE,
      "discord",
    );
    assert.equal(result.expiresIn, 120);
    const inserted = (db.insertLinkToken as ReturnType<typeof mock.fn>).mock
      .calls[0]!.arguments[0];
    const ttlSec = Math.round(
      (inserted.expiresAt.getTime() - Date.now()) / 1000,
    );
    assert.ok(ttlSec >= 119 && ttlSec <= 121);
  });
});

describe("confirmLinkToken", () => {
  it("returns ok:false when token is unknown", async () => {
    const db = makeDb();
    const result = await confirmLinkToken(
      makeCfg(db),
      "ABCD1234",
      "tg-uid",
      "tg_user",
    );
    assert.deepEqual(result, { ok: false });
    assert.equal(
      (db.upsertLink as ReturnType<typeof mock.fn>).mock.calls.length,
      0,
    );
  });

  it("normalizes token (trim + uppercase) before consume", async () => {
    const db = makeDb({
      consumeLinkToken: mock.fn(async () => ({
        userId: USER_ID,
        userType: USER_TYPE,
        provider: PROVIDER,
      })),
    });
    await confirmLinkToken(makeCfg(db), "  abcd1234  ", "tg-uid", null);
    assert.equal(
      (db.consumeLinkToken as ReturnType<typeof mock.fn>).mock.calls[0]!
        .arguments[0],
      "ABCD1234",
    );
  });

  it("upserts link and returns user info on success", async () => {
    const db = makeDb({
      consumeLinkToken: mock.fn(async () => ({
        userId: USER_ID,
        userType: USER_TYPE,
        provider: "discord",
      })),
    });
    const result = await confirmLinkToken(
      makeCfg(db),
      "TOKEN123",
      "discord-uid",
      "discord_user",
    );
    assert.deepEqual(result, {
      ok: true,
      userId: USER_ID,
      userType: USER_TYPE,
      provider: "discord",
    });
    assert.deepEqual(
      (db.upsertLink as ReturnType<typeof mock.fn>).mock.calls[0]!.arguments[0],
      {
        userId: USER_ID,
        userType: USER_TYPE,
        provider: "discord",
        providerUserId: "discord-uid",
        providerUsername: "discord_user",
      },
    );
  });
});
