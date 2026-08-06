import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, it, before, after, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createVerifierRouter, type AuthUser } from "../src/router.ts";
import { TelegramProvider } from "../src/providers/telegram.ts";
import { DiscordProvider } from "../src/providers/discord.ts";
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

const AUTH_USER: AuthUser = { userId: USER_ID, userType: USER_TYPE };

function makeChallengeRow(
  overrides: {
    codes?: Record<ProviderName, string>;
    verifiedProviders?: ProviderName[];
    expiresAt?: Date;
    completedAt?: Date | null;
  } = {},
) {
  return {
    userId: USER_ID,
    userType: USER_TYPE,
    purpose: "sensitive_action",
    codes: overrides.codes ?? { telegram: "111111", discord: "222222" },
    verifiedProviders: overrides.verifiedProviders ?? [],
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 60_000),
    completedAt: overrides.completedAt ?? null,
  };
}

/** Webhook handlers respond 200 before async work — дождаться фоновой обработки. */
async function settleWebhook() {
  await new Promise<void>((resolve) => setTimeout(resolve, 25));
}

function makeLinks(providers: ProviderName[] = ["telegram", "discord"]) {
  return providers.map((provider, i) => ({
    provider,
    providerUserId: `${provider}-uid-${i}`,
    providerUsername: `${provider}_user`,
  }));
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
  overrides: Partial<VerifierConfig> = {},
): VerifierConfig {
  return {
    db,
    providers,
    ...overrides,
  };
}

let baseUrl = "";
let server: Server;
let cfg: VerifierConfig;
let getUser: ReturnType<typeof mock.fn>;

async function request(
  method: string,
  path: string,
  opts: {
    headers?: Record<string, string>;
    body?: unknown;
  } = {},
) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...opts.headers,
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: unknown = undefined;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
  }
  return { status: res.status, json };
}

before(async () => {
  cfg = makeCfg(makeDb());
  getUser = mock.fn(async () => AUTH_USER);
  const app = express();
  app.use(express.json());
  app.use(createVerifierRouter(cfg, (req) => getUser(req)));
  await new Promise<void>((resolve) => {
    server = createServer(app).listen(0, "127.0.0.1", () => {
      const addr = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

beforeEach(() => {
  cfg.db = makeDb();
  cfg.providers = makeProviders();
  getUser.mock.mockImplementation(async () => AUTH_USER);
});

describe("createVerifierRouter auth", () => {
  it("returns 401 when getUser returns null", async () => {
    getUser.mock.mockImplementation(async () => null);
    const res = await request("GET", "/status");
    assert.equal(res.status, 401);
    assert.deepEqual(res.json, { error: "Unauthorized" });
  });
});

describe("GET /status", () => {
  it("returns linked providers and ready:false when fewer than 2 links", async () => {
    cfg.db.getLinks = mock.fn(async () => makeLinks(["telegram"]));
    const res = await request("GET", "/status");
    assert.equal(res.status, 200);
    assert.deepEqual(res.json, {
      linked: [{ provider: "telegram", username: "telegram_user" }],
      ready: false,
    });
  });

  it("returns ready:true when at least 2 providers are linked", async () => {
    const res = await request("GET", "/status");
    assert.equal(res.status, 200);
    assert.deepEqual(res.json, {
      linked: [
        { provider: "telegram", username: "telegram_user" },
        { provider: "discord", username: "discord_user" },
      ],
      ready: true,
    });
  });
});

describe("POST /link/start", () => {
  it("returns 400 for invalid provider", async () => {
    const res = await request("POST", "/link/start", {
      body: { provider: "email" },
    });
    assert.equal(res.status, 400);
    assert.deepEqual(res.json, {
      error: "provider must be 'telegram' or 'discord'",
    });
  });

  it("returns token and telegram instructions", async () => {
    const res = await request("POST", "/link/start", {
      body: { provider: "telegram" },
    });
    assert.equal(res.status, 200);
    const body = res.json as {
      token: string;
      expiresIn: number;
      instructions: string;
    };
    assert.match(body.token, /^[A-Z0-9]{8}$/);
    assert.equal(body.expiresIn, 600);
    assert.match(body.instructions, /Telegram-бот/);
    assert.match(body.instructions, /\/link /);
    assert.ok(body.instructions.includes(body.token));
    assert.equal(
      (cfg.db.insertLinkToken as ReturnType<typeof mock.fn>).mock.calls.length,
      1,
    );
  });

  it("returns discord instructions for discord provider", async () => {
    const res = await request("POST", "/link/start", {
      body: { provider: "discord" },
    });
    assert.equal(res.status, 200);
    const body = res.json as { instructions: string };
    assert.match(body.instructions, /Discord/);
  });
});

describe("POST /challenge", () => {
  it("returns 422 when user has fewer than 2 linked providers", async () => {
    cfg.db.getLinks = mock.fn(async () => makeLinks(["telegram"]));
    const res = await request("POST", "/challenge", {
      body: { purpose: "explicit" },
    });
    assert.equal(res.status, 422);
    const body = res.json as { error: string };
    assert.match(body.error, /Need at least 2 linked providers/);
  });

  it("creates challenge with default purpose explicit", async () => {
    const res = await request("POST", "/challenge", { body: {} });
    assert.equal(res.status, 201);
    const body = res.json as {
      challengeId: string;
      providers: ProviderName[];
    };
    assert.match(
      body.challengeId,
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    assert.deepEqual(body.providers, ["telegram", "discord"]);
  });
});

describe("POST /challenge/:id/verify", () => {
  it("returns 400 when provider or code is missing", async () => {
    const res = await request("POST", `/challenge/${CHALLENGE_ID}/verify`, {
      body: { provider: "telegram" },
    });
    assert.equal(res.status, 400);
    assert.deepEqual(res.json, { error: "provider and code are required" });
  });

  it("returns 400 for unknown challenge", async () => {
    const res = await request("POST", `/challenge/${CHALLENGE_ID}/verify`, {
      body: { provider: "telegram", code: "111111" },
    });
    assert.equal(res.status, 400);
    const body = res.json as { ok: boolean; status: { state: string } };
    assert.equal(body.ok, false);
    assert.deepEqual(body.status, { state: "expired" });
  });

  it("returns 200 when OTP is valid for a pending challenge", async () => {
    cfg.db.getChallenge = mock.fn(async () => makeChallengeRow());
    cfg.db.markProviderVerified = mock.fn(async () => ["telegram"]);
    const res = await request("POST", `/challenge/${CHALLENGE_ID}/verify`, {
      body: { provider: "telegram", code: "111111" },
    });
    assert.equal(res.status, 200);
    const body = res.json as {
      ok: boolean;
      status: { state: string; verifiedProviders?: ProviderName[] };
    };
    assert.equal(body.ok, true);
    assert.equal(body.status.state, "pending");
    assert.deepEqual(body.status.verifiedProviders, ["telegram"]);
  });

  it("accepts challenge id passed as array route param", async () => {
    cfg.db.getChallenge = mock.fn(async () => makeChallengeRow());
    cfg.db.markProviderVerified = mock.fn(async () => ["telegram"]);
    const res = await request(
      "POST",
      `/challenge/${CHALLENGE_ID}/verify?id=${CHALLENGE_ID}`,
      { body: { provider: "telegram", code: "111111" } },
    );
    assert.equal(res.status, 200);
    assert.equal(
      (cfg.db.getChallenge as ReturnType<typeof mock.fn>).mock.calls[0]!
        .arguments[0],
      CHALLENGE_ID,
    );
  });
});

describe("GET /challenge/:id", () => {
  it("returns expired for unknown challenge", async () => {
    const res = await request("GET", `/challenge/${CHALLENGE_ID}`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.json, { status: { state: "expired" } });
  });
});

describe("POST /webhooks/telegram", () => {
  it("always returns 200 ok for webhook payloads", async () => {
    const res = await request("POST", "/webhooks/telegram", {
      body: { message: { text: "hello", chat: { id: 1, type: "private" } } },
    });
    assert.equal(res.status, 200);
    assert.deepEqual(res.json, { ok: true });
    await settleWebhook();
  });

  it("ignores non-private telegram updates after responding 200", async () => {
    const res = await request("POST", "/webhooks/telegram", {
      body: { message: { text: "/link TOKEN99", chat: { id: 1, type: "group" } } },
    });
    assert.equal(res.status, 200);
    await settleWebhook();
    assert.equal(
      (cfg.db.consumeLinkToken as ReturnType<typeof mock.fn>).mock.calls.length,
      0,
    );
  });

  it("ignores telegram messages without /link token", async () => {
    const res = await request("POST", "/webhooks/telegram", {
      body: {
        message: {
          text: "привет",
          chat: { id: 99, type: "private" },
          from: { username: "tg_user" },
        },
      },
    });
    assert.equal(res.status, 200);
    await settleWebhook();
    assert.equal(
      (cfg.db.consumeLinkToken as ReturnType<typeof mock.fn>).mock.calls.length,
      0,
    );
  });

  it("sends failure DM when link token is invalid", async () => {
    cfg.providers = [
      new TelegramProvider("tg-bot-token"),
      { name: "discord", sendOtp: mock.fn(async () => undefined) },
    ];
    cfg.db.consumeLinkToken = mock.fn(async () => null);
    const originalFetch = globalThis.fetch;
    const fetchCalls: { url: string; body: string }[] = [];
    const fetchRestore = mock.method(
      globalThis,
      "fetch",
      async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = String(url);
        if (urlStr.includes("api.telegram.org")) {
          fetchCalls.push({
            url: urlStr,
            body: String(init?.body ?? ""),
          });
          return ({ ok: true, text: async () => "" }) as Response;
        }
        return originalFetch(url, init);
      },
    );
    try {
      const res = await request("POST", "/webhooks/telegram", {
        body: {
          message: {
            text: "/link BADTOKEN",
            chat: { id: 77, type: "private" },
            from: { username: "tg_user" },
          },
        },
      });
      assert.equal(res.status, 200);
      await settleWebhook();
      assert.ok(
        fetchCalls.some((c) => c.body.includes("недействителен")),
        "expected failure DM via Telegram API",
      );
    } finally {
      fetchRestore.mock.restore();
    }
  });

  it("confirms link token from /link command", async () => {
    cfg.providers = [
      new TelegramProvider("tg-bot-token"),
      { name: "discord", sendOtp: mock.fn(async () => undefined) },
    ];
    cfg.db.consumeLinkToken = mock.fn(async () => ({
      userId: USER_ID,
      userType: USER_TYPE,
      provider: "telegram",
    }));
    const originalFetch = globalThis.fetch;
    const fetchRestore = mock.method(
      globalThis,
      "fetch",
      async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = String(url);
        if (urlStr.includes("api.telegram.org")) {
          return ({ ok: true, text: async () => "" }) as Response;
        }
        return originalFetch(url, init);
      },
    );
    try {
      const res = await request("POST", "/webhooks/telegram", {
        body: {
          message: {
            text: "/link ABCD1234",
            chat: { id: 42, type: "private" },
            from: { username: "tg_user" },
          },
        },
      });
      assert.equal(res.status, 200);
      assert.equal(
        (cfg.db.consumeLinkToken as ReturnType<typeof mock.fn>).mock.calls[0]!
          .arguments[0],
        "ABCD1234",
      );
      assert.equal(
        (cfg.db.upsertLink as ReturnType<typeof mock.fn>).mock.calls.length,
        1,
      );
    } finally {
      fetchRestore.mock.restore();
    }
  });
});

describe("POST /webhooks/discord", () => {
  it("always returns 200 ok for webhook payloads", async () => {
    const res = await request("POST", "/webhooks/discord", {
      body: { author: { bot: true }, content: "ping" },
    });
    assert.equal(res.status, 200);
    assert.deepEqual(res.json, { ok: true });
  });

  it("confirms link token from /link command in DM", async () => {
    cfg.providers = [
      { name: "telegram", sendOtp: mock.fn(async () => undefined) },
      new DiscordProvider("dc-bot-token"),
    ];
    cfg.db.consumeLinkToken = mock.fn(async () => ({
      userId: USER_ID,
      userType: USER_TYPE,
      provider: "discord",
    }));
    const originalFetch = globalThis.fetch;
    const fetchRestore = mock.method(
      globalThis,
      "fetch",
      async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = String(url);
        if (urlStr.includes("discord.com")) {
          return ({
            ok: true,
            text: async () => "",
            json: async () => ({ id: "dm-1" }),
          }) as Response;
        }
        return originalFetch(url, init);
      },
    );
    try {
      const res = await request("POST", "/webhooks/discord", {
        body: {
          channel: { type: 1 },
          author: { id: "dc-user", username: "dc_user", bot: false },
          content: "/link TOKEN123",
        },
      });
      assert.equal(res.status, 200);
      assert.equal(
        (cfg.db.consumeLinkToken as ReturnType<typeof mock.fn>).mock.calls[0]!
          .arguments[0],
        "TOKEN123",
      );
      assert.equal(
        (cfg.db.upsertLink as ReturnType<typeof mock.fn>).mock.calls.length,
        1,
      );
    } finally {
      fetchRestore.mock.restore();
    }
  });
});
