import { test } from "node:test";
import assert from "node:assert/strict";

const {
  fmtLzt,
  quotaKindLabel,
  quotaKindAccentColor,
  formatRoyaltyRate,
  formatRoyaltySource,
  formatQuotaDescription,
  formatMovementKind,
  isQuotaCloseable,
  getCloseButtonLabel,
} = await import("../src/pages/quota-detail-helpers.ts");

test("fmtLzt formats numbers with ru-RU locale and LZT suffix", () => {
  assert.equal(fmtLzt(1234), "1\u00a0234 LZT");
  assert.equal(fmtLzt(0), "0 LZT");
});

test("fmtLzt returns em dash for null and undefined", () => {
  assert.equal(fmtLzt(null), "—");
  assert.equal(fmtLzt(undefined), "—");
});

test("quotaKindLabel and quotaKindAccentColor distinguish royalty and sponsor", () => {
  assert.equal(quotaKindLabel("royalty"), "Роялти");
  assert.equal(quotaKindLabel("sponsor"), "Спонсор");
  assert.equal(quotaKindAccentColor("royalty"), "#fbbf24");
  assert.equal(quotaKindAccentColor("sponsor"), "#38bdf8");
});

test("formatRoyaltyRate formats percent and fixed per-minute tariffs", () => {
  assert.equal(formatRoyaltyRate("percent", 12), "12% / мин");
  assert.equal(formatRoyaltyRate("percent", null), "0% / мин");
  assert.equal(formatRoyaltyRate("fixed_per_minute", 5), "5 LZT/мин");
  assert.equal(formatRoyaltyRate(null, 7), "7 LZT/мин");
});

test("formatRoyaltySource maps player and host sources", () => {
  assert.equal(formatRoyaltySource("player"), "Сверху с игрока");
  assert.equal(formatRoyaltySource("host"), "Из доли хоста");
  assert.equal(formatRoyaltySource(null), "Из доли хоста");
});

test("formatQuotaDescription falls back to placeholder", () => {
  assert.equal(formatQuotaDescription("Описание"), "Описание");
  assert.equal(formatQuotaDescription(""), "Без описания");
  assert.equal(formatQuotaDescription(null), "Без описания");
});

test("formatMovementKind strips quota_ prefix", () => {
  assert.equal(formatMovementKind("quota_escrow"), "escrow");
  assert.equal(formatMovementKind("payout"), "payout");
});

test("isQuotaCloseable excludes closed and expired statuses", () => {
  assert.equal(isQuotaCloseable("draft"), true);
  assert.equal(isQuotaCloseable("active"), true);
  assert.equal(isQuotaCloseable("paused"), true);
  assert.equal(isQuotaCloseable("closed"), false);
  assert.equal(isQuotaCloseable("expired"), false);
});

test("getCloseButtonLabel toggles confirmation text", () => {
  assert.equal(getCloseButtonLabel(false), "Закрыть");
  assert.equal(getCloseButtonLabel(true), "Подтвердить закрытие");
});
