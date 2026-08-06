import { test } from "node:test";
import assert from "node:assert/strict";

const {
  LZT_PER_USD,
  formatInt,
  formatUsd,
  resolveCoverImageUrl,
  extractAfter,
  resolveJoinRedirectUrl,
  filterPlayableHosts,
  computeLztPerMin,
  isPlayableHost,
  pickBestPlayableHost,
  resolvePlayNowInvitePath,
  PLAY_NOW_FALLBACK_HREF,
  DEMO_GAME_HREF,
} = await import("../src/pages/landing-helpers.ts");

test("LZT_PER_USD is stable", () => {
  assert.equal(LZT_PER_USD, 200);
});

test("formatInt groups thousands with thin spaces", () => {
  assert.equal(formatInt(1248), "1 248");
  assert.equal(formatInt(1000000), "1 000 000");
  assert.equal(formatInt(42), "42");
  assert.equal(formatInt(42.7), "43");
});

test("formatUsd converts cents to dollar label", () => {
  assert.equal(formatUsd(124800), "$1 248");
  assert.equal(formatUsd(50), "$1");
  assert.equal(formatUsd(0), "$0");
});

test("resolveCoverImageUrl handles absolute and relative paths", () => {
  assert.equal(resolveCoverImageUrl("https://cdn/img.png", "/"), "https://cdn/img.png");
  assert.equal(resolveCoverImageUrl("/covers/a.png", "https://app/"), "https://app/covers/a.png");
  assert.equal(resolveCoverImageUrl(null, "/"), null);
  assert.equal(resolveCoverImageUrl("", "/"), null);
});

test("extractAfter returns substring after marker until path delimiter", () => {
  assert.equal(extractAfter("/play/i/ABC123/extra", "/play/i/"), "ABC123");
  assert.equal(extractAfter("https://x/play/TOKEN?x=1", "/play/"), "TOKEN");
  assert.equal(extractAfter("/games", "/play/"), null);
  assert.equal(extractAfter("/play/i/", "/play/i/"), null);
});

test("resolveJoinRedirectUrl maps invite links, player tokens and bare tokens", () => {
  const base = "/";
  assert.equal(
    resolveJoinRedirectUrl("https://app.example/play/i/INV42", base),
    "/play/i/INV42",
  );
  assert.equal(
    resolveJoinRedirectUrl("/play/PLAYER-TOK", base),
    "/play/PLAYER-TOK",
  );
  assert.equal(resolveJoinRedirectUrl("bare-token", base), "/play/bare-token");
  assert.equal(resolveJoinRedirectUrl("   ", base), null);
});

test("resolveJoinRedirectUrl prefers invite code over player token in path", () => {
  assert.equal(
    resolveJoinRedirectUrl("https://x/play/i/INV/play/ignored", "/"),
    "/play/i/INV",
  );
});

test("filterPlayableHosts keeps heartbeat-online hosts with invite codes up to limit", () => {
  const hosts = [
    { id: "a", isOnline: true, inviteCode: "x" },
    { id: "b", isOnline: false, inviteCode: "y" },
    { id: "c", isOnline: true, inviteCode: null },
    { id: "d", isOnline: true, inviteCode: "z" },
    { id: "e", isOnline: true, inviteCode: "w" },
    { id: "f", isOnline: true, inviteCode: "v" },
    { id: "g", isOnline: true, inviteCode: "u" },
    { id: "h", isOnline: true, inviteCode: "t" },
    { id: "i", isOnline: true, inviteCode: "s" },
    { id: "j", isOnline: true, inviteCode: "r" },
  ];
  const filtered = filterPlayableHosts(hosts, 6);
  assert.equal(filtered.length, 6);
  assert.deepEqual(
    filtered.map((h) => h.id),
    ["a", "d", "e", "f", "g", "h"],
  );
});

test("computeLztPerMin prefers game price over host minute USD", () => {
  assert.equal(computeLztPerMin({ pricePerMinuteLzt: 15 }, 0.04), 15);
  assert.equal(computeLztPerMin(undefined, 0.04), 8);
});

test("isPlayableHost requires agent heartbeat and invite code", () => {
  assert.equal(isPlayableHost({ isOnline: true, inviteCode: "x" }), true);
  assert.equal(
    isPlayableHost({ status: "online", inviteCode: "x", isOnline: false }),
    false,
  );
  assert.equal(isPlayableHost({ isOnline: false, inviteCode: "x" }), false);
  assert.equal(isPlayableHost({ isOnline: true, inviteCode: null }), false);
});

test("pickBestPlayableHost ranks tier, ping, then price", () => {
  const hosts = [
    { id: "a", isOnline: true, inviteCode: "a", hostTier: "meets_min", pingMs: 40, minutePriceUsd: 0.05 },
    { id: "b", isOnline: true, inviteCode: "b", hostTier: "above_rec", pingMs: 80, minutePriceUsd: 0.06 },
    { id: "c", isOnline: true, inviteCode: "c", hostTier: "above_rec", pingMs: 20, minutePriceUsd: 0.08 },
    { id: "d", isOnline: false, inviteCode: "d", hostTier: "above_rec", pingMs: 5, minutePriceUsd: 0.01 },
  ];
  assert.equal(pickBestPlayableHost(hosts)?.id, "c");
});

test("pickBestPlayableHost returns null when no playable hosts", () => {
  assert.equal(pickBestPlayableHost([]), null);
  assert.equal(
    pickBestPlayableHost([{ isOnline: false, inviteCode: "x" }]),
    null,
  );
});

test("resolvePlayNowInvitePath builds /play/i path", () => {
  assert.equal(resolvePlayNowInvitePath({ inviteCode: "INV42" }), "/play/i/INV42");
  assert.equal(resolvePlayNowInvitePath({ inviteCode: null }), null);
  assert.equal(resolvePlayNowInvitePath(null), null);
});

test("PLAY_NOW_FALLBACK_HREF points to games catalog", () => {
  assert.equal(PLAY_NOW_FALLBACK_HREF, "/games");
});

test("DEMO_GAME_HREF points to browser demo game", () => {
  assert.equal(DEMO_GAME_HREF, "/games/rogue-fable-3");
});
