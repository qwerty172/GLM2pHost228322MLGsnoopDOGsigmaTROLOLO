import { test } from "node:test";
import assert from "node:assert/strict";

const {
  fmtLzt,
  quotaStatusMeta,
  quotaKindFilterLabel,
  buildPublicQuotaParams,
  selectQuotaRows,
  filterQuotasBySearch,
  filterCompatibleQuotas,
  getQuotasLoadingState,
  getQuotasEmptyState,
  formatQuotaMinSpecs,
  formatRoyaltyRateLine,
  formatSponsorPricingLines,
  isQuotaIncompatible,
} = await import("../src/pages/quotas-helpers.ts");

function quota(overrides = {}) {
  return {
    id: "q1",
    title: "Test Quota",
    description: "Описание",
    kind: "royalty",
    status: "active",
    visibility: "public",
    ...overrides,
  };
}

test("fmtLzt formats numbers with ru-RU locale and LZT suffix", () => {
  assert.equal(fmtLzt(1234), "1\u00a0234 LZT");
  assert.equal(fmtLzt(0), "0 LZT");
});

test("fmtLzt returns em dash for null and undefined", () => {
  assert.equal(fmtLzt(null), "—");
  assert.equal(fmtLzt(undefined), "—");
});

test("quotaStatusMeta maps known statuses and falls back to draft", () => {
  assert.equal(quotaStatusMeta("active").label, "Активна");
  assert.equal(quotaStatusMeta("paused").label, "Пауза");
  assert.equal(quotaStatusMeta("exhausted").label, "Исчерпана");
  assert.equal(quotaStatusMeta("unknown" ).label, "Черновик");
});

test("quotaKindFilterLabel maps filter keys to Russian labels", () => {
  assert.equal(quotaKindFilterLabel(""), "Любой тип");
  assert.equal(quotaKindFilterLabel("royalty"), "Роялти");
  assert.equal(quotaKindFilterLabel("sponsor"), "Спонсор");
});

test("buildPublicQuotaParams includes only non-empty filters", () => {
  assert.deepEqual(buildPublicQuotaParams("", ""), {});
  assert.deepEqual(buildPublicQuotaParams("royalty", ""), { kind: "royalty" });
  assert.deepEqual(buildPublicQuotaParams("", "game-1"), { gameId: "game-1" });
  assert.deepEqual(buildPublicQuotaParams("sponsor", "game-2"), {
    kind: "sponsor",
    gameId: "game-2",
  });
});

test("selectQuotaRows picks data source by tab", () => {
  const pub = [quota({ id: "p1" })];
  const mine = [quota({ id: "m1" })];
  const applied = [quota({ id: "a1" })];
  assert.deepEqual(selectQuotaRows("public", mine, applied, pub).map((q) => q.id), ["p1"]);
  assert.deepEqual(selectQuotaRows("mine", mine, applied, pub).map((q) => q.id), ["m1"]);
  assert.deepEqual(selectQuotaRows("applied", mine, applied, pub).map((q) => q.id), ["a1"]);
  assert.deepEqual(selectQuotaRows("public", undefined, undefined, undefined), []);
});

test("filterQuotasBySearch matches title and description case-insensitively", () => {
  const rows = [
    quota({ id: "1", title: "CS2 Royalty", description: "" }),
    quota({ id: "2", title: "Other", description: "для Dota 2" }),
    quota({ id: "3", title: "Hidden", description: "secret" }),
  ];
  assert.deepEqual(
    filterQuotasBySearch(rows, "  cs2 ").map((q) => q.id),
    ["1"],
  );
  assert.deepEqual(
    filterQuotasBySearch(rows, "dota").map((q) => q.id),
    ["2"],
  );
  assert.deepEqual(filterQuotasBySearch(rows, ""), rows);
});

test("filterCompatibleQuotas hides incompatible rows only on public tab with host token", () => {
  const rows = [quota({ id: "ok" }), quota({ id: "bad" })];
  const map = new Map([
    ["ok", { compatible: true, tier: "meets_min", reason: null }],
    ["bad", { compatible: false, tier: "below_min", reason: "Мало VRAM" }],
  ]);
  assert.deepEqual(
    filterCompatibleQuotas(rows, true, "public", "tok", map).map((q) => q.id),
    ["ok"],
  );
  assert.deepEqual(
    filterCompatibleQuotas(rows, true, "mine", "tok", map).map((q) => q.id),
    ["ok", "bad"],
  );
  assert.deepEqual(
    filterCompatibleQuotas(rows, false, "public", "tok", map).map((q) => q.id),
    ["ok", "bad"],
  );
});

test("getQuotasLoadingState reflects active tab query", () => {
  assert.equal(getQuotasLoadingState("public", false, true, true), true);
  assert.equal(getQuotasLoadingState("mine", true, false, false), true);
  assert.equal(getQuotasLoadingState("applied", false, true, false), true);
  assert.equal(getQuotasLoadingState("public", false, true, false), false);
});

test("getQuotasEmptyState returns tab-specific Russian copy", () => {
  assert.match(getQuotasEmptyState("mine").title, /нет квот/);
  assert.match(getQuotasEmptyState("applied").title, /не применялись/);
  assert.equal(getQuotasEmptyState("public").title, "Ничего не найдено");
});

test("formatQuotaMinSpecs joins hardware requirements", () => {
  assert.equal(
    formatQuotaMinSpecs(quota({ minGpuVram: 8, minRamGb: 16, minCpuCores: 4 })),
    "8GB VRAM+ / 16GB RAM+ / 4 ядер+",
  );
  assert.equal(formatQuotaMinSpecs(quota({ minGpuVram: null, minRamGb: null })), null);
});

test("formatRoyaltyRateLine formats percent and fixed tariffs with source", () => {
  assert.equal(
    formatRoyaltyRateLine(quota({ royaltyBasis: "percent", royaltyValue: 12, royaltySource: "player" })),
    "12% / мин (с игрока)",
  );
  assert.equal(
    formatRoyaltyRateLine(quota({ royaltyBasis: "fixed_per_minute", royaltyValue: 5, royaltySource: "host" })),
    "5 LZT/мин (из доли хоста)",
  );
});

test("formatSponsorPricingLines formats host/player rates and escrow", () => {
  const lines = formatSponsorPricingLines(
    quota({
      kind: "sponsor",
      sponsorHostPerMinuteLzt: 100,
      sponsorPlayerPerMinuteLzt: 50,
      escrowRemainingLzt: 5000,
    }),
  );
  assert.match(lines.ratesLine, /Хосту:.*100.*LZT/);
  assert.match(lines.ratesLine, /Игроку:.*50.*LZT/);
  assert.match(lines.escrowLine, /5\u00a0000 LZT/);
});

test("isQuotaIncompatible detects incompatible compatibility results", () => {
  assert.equal(isQuotaIncompatible({ compatible: false, tier: "below_min", reason: "x" }), true);
  assert.equal(isQuotaIncompatible({ compatible: true, tier: "meets_min", reason: null }), false);
  assert.equal(isQuotaIncompatible(null), false);
});
