import { test } from "node:test";
import assert from "node:assert/strict";

const { usePlayNowHref, isPlayNavActive } = await import("../src/hooks/use-play-now-href.ts");
const {
  pickBestPlayableHost,
  resolvePlayNowInvitePath,
  PLAY_NOW_FALLBACK_HREF,
} = await import("../src/pages/landing-helpers.ts");

test("usePlayNowHref is exported React hook", () => {
  assert.equal(typeof usePlayNowHref, "function");
  assert.equal(usePlayNowHref.name, "usePlayNowHref");
});

test("usePlayNowHref resolves invite path or falls back to /games", () => {
  const hosts = [
    { status: "online", inviteCode: "INV42", hostTier: "above_rec", pingMs: 10 },
  ];
  const best = pickBestPlayableHost(hosts);
  const href = resolvePlayNowInvitePath(best) ?? PLAY_NOW_FALLBACK_HREF;
  assert.equal(href, "/play/i/INV42");

  const fallback =
    resolvePlayNowInvitePath(pickBestPlayableHost([])) ?? PLAY_NOW_FALLBACK_HREF;
  assert.equal(fallback, "/games");
});

test("isPlayNavActive highlights play, games and hosts routes", () => {
  assert.equal(isPlayNavActive("/play/i/INV"), true);
  assert.equal(isPlayNavActive("/play/token"), true);
  assert.equal(isPlayNavActive("/games"), true);
  assert.equal(isPlayNavActive("/hosts"), true);
  assert.equal(isPlayNavActive("/host"), false);
  assert.equal(isPlayNavActive(undefined), false);
});
