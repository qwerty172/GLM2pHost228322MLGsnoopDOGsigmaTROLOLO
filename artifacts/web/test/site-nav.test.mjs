import { test } from "node:test";
import assert from "node:assert/strict";

const {
  SITE_NAV_GUEST_TOAST,
  isSiteNavPathActive,
  isSiteNavHostActive,
  shouldHideSiteNavGuestBanner,
  formatLztBalanceChip,
  isGuestAccountNameValid,
} = await import("../src/components/site-nav.tsx");

test("SITE_NAV_GUEST_TOAST messages are Russian", () => {
  assert.match(SITE_NAV_GUEST_TOAST.success, /Аккаунт создан/);
  assert.match(SITE_NAV_GUEST_TOAST.error, /Не удалось/);
});

test("isSiteNavPathActive matches exact path", () => {
  assert.equal(isSiteNavPathActive("/games", "/games"), true);
  assert.equal(isSiteNavPathActive("/games", "/hosts"), false);
  assert.equal(isSiteNavPathActive(undefined, "/games"), false);
});

test("isSiteNavHostActive highlights host wallet routes", () => {
  assert.equal(isSiteNavHostActive("/host"), true);
  assert.equal(isSiteNavHostActive("/host/wallet"), true);
  assert.equal(isSiteNavHostActive("/wallet"), true);
  assert.equal(isSiteNavHostActive("/games"), false);
  assert.equal(isSiteNavHostActive(undefined), false);
});

test("shouldHideSiteNavGuestBanner hides banner on play pages", () => {
  assert.equal(shouldHideSiteNavGuestBanner("/play/abc"), true);
  assert.equal(shouldHideSiteNavGuestBanner("/host/play/session"), true);
  assert.equal(shouldHideSiteNavGuestBanner("/games"), false);
  assert.equal(shouldHideSiteNavGuestBanner(undefined), false);
});

test("formatLztBalanceChip truncates and formats in ru-RU", () => {
  assert.equal(formatLztBalanceChip(1234.9), formatLztBalanceChip(1234));
  assert.match(formatLztBalanceChip(1234), /^1[\s\u00a0\u202f]234 LZT$/);
  assert.match(formatLztBalanceChip(50000), /^50[\s\u00a0\u202f]000 LZT$/);
});

test("isGuestAccountNameValid requires at least two trimmed characters", () => {
  assert.equal(isGuestAccountNameValid(""), false);
  assert.equal(isGuestAccountNameValid("  "), false);
  assert.equal(isGuestAccountNameValid("a"), false);
  assert.equal(isGuestAccountNameValid("  ab  "), true);
});
