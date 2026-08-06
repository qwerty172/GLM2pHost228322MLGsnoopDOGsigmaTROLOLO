import { test } from "node:test";
import assert from "node:assert/strict";

const {
  isSiteNavHostActive,
  shouldHideSiteNavGuestBanner,
  isSiteNavPathActive,
  isGuestUpgradeNameValid,
  formatWalletBalanceLzt,
  getSiteNavPlayHref,
  isSiteNavPlayActive,
  SITE_NAV_PLAY_HREF,
} = await import("../src/components/site-nav.tsx");

test("isSiteNavHostActive highlights host dashboard and wallet routes", () => {
  assert.equal(isSiteNavHostActive("/host"), true);
  assert.equal(isSiteNavHostActive("/host/wallet"), true);
  assert.equal(isSiteNavHostActive("/wallet"), true);
  assert.equal(isSiteNavHostActive("/hosts"), false);
  assert.equal(isSiteNavHostActive("/games"), false);
  assert.equal(isSiteNavHostActive(undefined), false);
});

test("shouldHideSiteNavGuestBanner hides banner on play routes", () => {
  assert.equal(shouldHideSiteNavGuestBanner("/play/abc"), true);
  assert.equal(shouldHideSiteNavGuestBanner("/host/play/xyz"), true);
  assert.equal(shouldHideSiteNavGuestBanner("/hosts"), false);
  assert.equal(shouldHideSiteNavGuestBanner("/wallet"), false);
  assert.equal(shouldHideSiteNavGuestBanner(undefined), false);
});

test("isSiteNavPathActive matches exact path", () => {
  assert.equal(isSiteNavPathActive("/hosts", "/hosts"), true);
  assert.equal(isSiteNavPathActive("/profile", "/hosts"), false);
  assert.equal(isSiteNavPathActive(undefined, "/hosts"), false);
});

test("getSiteNavPlayHref and isSiteNavPlayActive unify desktop and mobile «Играть»", () => {
  assert.equal(getSiteNavPlayHref(), "/games");
  assert.equal(SITE_NAV_PLAY_HREF, "/games");
  assert.equal(isSiteNavPlayActive("/hosts"), true);
  assert.equal(isSiteNavPlayActive("/play/i/ABC"), true);
  assert.equal(isSiteNavPlayActive("/games"), true);
  assert.equal(isSiteNavPlayActive("/profile"), false);
  assert.equal(isSiteNavPlayActive(undefined), false);
});

test("isGuestUpgradeNameValid requires at least two non-whitespace characters", () => {
  assert.equal(isGuestUpgradeNameValid(""), false);
  assert.equal(isGuestUpgradeNameValid("  "), false);
  assert.equal(isGuestUpgradeNameValid("a"), false);
  assert.equal(isGuestUpgradeNameValid("  ab  "), true);
  assert.equal(isGuestUpgradeNameValid("Игрок"), true);
});

test("formatWalletBalanceLzt formats truncated balance in ru-RU with LZT suffix", () => {
  assert.equal(formatWalletBalanceLzt(1234.9), "1\u00a0234 LZT");
  assert.equal(formatWalletBalanceLzt(0), "0 LZT");
  assert.equal(formatWalletBalanceLzt(1_000_000), "1\u00a0000\u00a0000 LZT");
});
