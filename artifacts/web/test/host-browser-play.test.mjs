import { test } from "node:test";
import assert from "node:assert/strict";

const {
  HOST_TOKEN_STORAGE_PREFIX,
  BROWSER_HOST_URL_STORAGE_PREFIX,
  GLOBAL_HOST_TOKEN_KEY,
  getStoredHostToken,
  getStoredBrowserHostUrl,
  resolveBrowserHostUrl,
  isExternalBrowserHostUrl,
  buildBrowserPlayIframeSrc,
  buildBrowserPlayShareUrl,
  sanitizeIceServers,
  buildBrowserHostSignalWsUrl,
  computeEarnedLzt,
} = await import("../src/pages/host/browser-play-helpers.ts");

function mockStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => {
      data.set(key, String(value));
    },
    removeItem: (key) => {
      data.delete(key);
    },
    _data: data,
  };
}

test("storage prefixes are stable", () => {
  assert.equal(HOST_TOKEN_STORAGE_PREFIX, "streamline.browserHostToken:");
  assert.equal(BROWSER_HOST_URL_STORAGE_PREFIX, "streamline.browserHostUrl:");
  assert.equal(GLOBAL_HOST_TOKEN_KEY, "streamline.hostToken");
});

test("getStoredHostToken prefers session-scoped key over global host token", () => {
  const storage = mockStorage({
    [HOST_TOKEN_STORAGE_PREFIX + "sess-1"]: "session-tok",
    [GLOBAL_HOST_TOKEN_KEY]: "global-tok",
  });
  assert.equal(getStoredHostToken("sess-1", storage), "session-tok");
});

test("getStoredHostToken does not fall back to dashboard host token (browser-host mints per-session token)", () => {
  const storage = mockStorage({
    [GLOBAL_HOST_TOKEN_KEY]: "global-tok",
  });
  assert.equal(getStoredHostToken("sess-1", storage), null);
});

test("getStoredBrowserHostUrl reads session-scoped browser host URL", () => {
  const storage = mockStorage({
    [BROWSER_HOST_URL_STORAGE_PREFIX + "sess-2"]: "https://game.example/play",
  });
  assert.equal(getStoredBrowserHostUrl("sess-2", storage), "https://game.example/play");
  assert.equal(getStoredBrowserHostUrl("missing", storage), null);
});

test("resolveBrowserHostUrl prefers localStorage and falls back to http(s) appName", () => {
  assert.equal(resolveBrowserHostUrl("games/foo", "https://ignored"), "games/foo");
  assert.equal(resolveBrowserHostUrl(null, "https://shellshock.io"), "https://shellshock.io");
  assert.equal(resolveBrowserHostUrl(null, "Shellshock"), null);
  assert.equal(resolveBrowserHostUrl("", null), null);
});

test("isExternalBrowserHostUrl detects external http(s) URLs", () => {
  assert.equal(isExternalBrowserHostUrl("https://deepseek.com"), true);
  assert.equal(isExternalBrowserHostUrl("http://localhost"), true);
  assert.equal(isExternalBrowserHostUrl("games/shellshock"), false);
  assert.equal(isExternalBrowserHostUrl(null), false);
});

test("buildBrowserPlayIframeSrc normalizes slashes", () => {
  assert.equal(buildBrowserPlayIframeSrc("/", "games/demo"), "/games/demo");
  assert.equal(buildBrowserPlayIframeSrc("/app/", "/games/demo"), "/app/games/demo");
});

test("buildBrowserPlayShareUrl uses invite code or player token", () => {
  assert.equal(
    buildBrowserPlayShareUrl({
      origin: "https://play.example.com",
      baseUrl: "/",
      inviteCode: "ABC123",
      playerToken: "tok",
    }),
    "https://play.example.com/play/i/ABC123",
  );
  assert.equal(
    buildBrowserPlayShareUrl({
      origin: "https://play.example.com",
      baseUrl: "/app/",
      playerToken: "player-tok",
    }),
    "https://play.example.com/app/play/player-tok",
  );
});

test("sanitizeIceServers drops invalid URIs and falls back to Google STUN", () => {
  assert.deepEqual(sanitizeIceServers(undefined), [{ urls: "stun:stun.l.google.com:19302" }]);
  assert.deepEqual(sanitizeIceServers([{ urls: "ftp://bad" }]), [
    { urls: "stun:stun.l.google.com:19302" },
  ]);
  assert.deepEqual(
    sanitizeIceServers([
      { urls: "stun:stun.example.com" },
      { urls: ["turn:turn.example.com", "not-ice"] },
    ]),
    [{ urls: "stun:stun.example.com" }],
  );
});

test("buildBrowserHostSignalWsUrl encodes session and host token", () => {
  assert.equal(
    buildBrowserHostSignalWsUrl({
      sessionId: "sess/id",
      hostToken: "tok+=",
      pageProtocol: "https:",
      host: "play.example.com",
      baseUrl: "/",
    }),
    "wss://play.example.com/api/signal?role=host&sessionId=sess%2Fid&hostToken=tok%2B%3D",
  );
  assert.equal(
    buildBrowserHostSignalWsUrl({
      sessionId: "s1",
      hostToken: "h1",
      pageProtocol: "http:",
      host: "localhost:5173",
      baseUrl: "/app/",
    }),
    "ws://localhost:5173/app/api/signal?role=host&sessionId=s1&hostToken=h1",
  );
});

test("computeEarnedLzt projects linear earnings from session start", () => {
  const startedAt = "2026-01-01T00:00:00.000Z";
  const nowMs = new Date("2026-01-01T00:30:00.000Z").getTime();
  assert.equal(computeEarnedLzt(startedAt, 0.05, nowMs), 300);
  assert.equal(computeEarnedLzt(startedAt, 0, nowMs), 0);
  assert.equal(
    computeEarnedLzt("2026-01-01T01:00:00.000Z", 0.05, nowMs),
    0,
  );
});
