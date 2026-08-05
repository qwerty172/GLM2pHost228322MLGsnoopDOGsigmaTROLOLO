import { test } from "node:test";
import assert from "node:assert/strict";

const {
  DEFAULT_PRESET_GAMES,
  PRESET_GAMES_LIMIT,
  resolvePresetGames,
  buildApplicableQuotasParams,
  canCreateSession,
  isSubmitDisabled,
  normalizeQuotaAccessCode,
  buildShareLink,
  formatQuotaRateLabel,
  buildCreateSessionBody,
} = await import("../src/pages/host/setup-helpers.ts");

test("DEFAULT_PRESET_GAMES and PRESET_GAMES_LIMIT are stable", () => {
  assert.equal(DEFAULT_PRESET_GAMES.length, 5);
  assert.equal(PRESET_GAMES_LIMIT, 6);
  assert.ok(DEFAULT_PRESET_GAMES.includes("CS2"));
});

test("resolvePresetGames uses catalog titles when available", () => {
  const catalog = [
    { title: "Game A" },
    { title: "Game B" },
    { title: "Game C" },
    { title: "Game D" },
    { title: "Game E" },
    { title: "Game F" },
    { title: "Game G" },
  ];
  assert.deepEqual(resolvePresetGames(catalog), [
    "Game A",
    "Game B",
    "Game C",
    "Game D",
    "Game E",
    "Game F",
  ]);
});

test("resolvePresetGames falls back to defaults for empty catalog", () => {
  assert.deepEqual(resolvePresetGames([]), [...DEFAULT_PRESET_GAMES]);
  assert.deepEqual(resolvePresetGames(null), [...DEFAULT_PRESET_GAMES]);
  assert.deepEqual(resolvePresetGames(undefined), [...DEFAULT_PRESET_GAMES]);
});

test("buildApplicableQuotasParams includes accessCode only when set", () => {
  assert.deepEqual(buildApplicableQuotasParams("host-1", ""), {
    hostToken: "host-1",
  });
  assert.deepEqual(buildApplicableQuotasParams(null, "ABC"), {
    hostToken: "",
    accessCode: "ABC",
  });
  assert.deepEqual(buildApplicableQuotasParams("host-1", "A3F9"), {
    hostToken: "host-1",
    accessCode: "A3F9",
  });
});

test("canCreateSession requires host token and non-empty app name", () => {
  assert.equal(canCreateSession("host-1", "Cyberpunk"), true);
  assert.equal(canCreateSession("host-1", "  "), false);
  assert.equal(canCreateSession(null, "Cyberpunk"), false);
  assert.equal(canCreateSession("", "Cyberpunk"), false);
});

test("isSubmitDisabled blocks pending state and empty app name", () => {
  assert.equal(isSubmitDisabled(false, "Game"), false);
  assert.equal(isSubmitDisabled(true, "Game"), true);
  assert.equal(isSubmitDisabled(false, "  "), true);
});

test("normalizeQuotaAccessCode uppercases input", () => {
  assert.equal(normalizeQuotaAccessCode("a3f9kmp2"), "A3F9KMP2");
  assert.equal(normalizeQuotaAccessCode(""), "");
});

test("buildShareLink prefers invite code over player token", () => {
  assert.equal(
    buildShareLink({
      origin: "https://example.com",
      baseUrl: "/",
      playerToken: "tok-1",
      inviteCode: "INV123",
    }),
    "https://example.com/play/i/INV123",
  );
  assert.equal(
    buildShareLink({
      origin: "https://example.com",
      baseUrl: "/app/",
      playerToken: "tok-1",
    }),
    "https://example.com/app/play/tok-1",
  );
});

test("formatQuotaRateLabel formats royalty percent, flat and sponsor quotas", () => {
  assert.equal(
    formatQuotaRateLabel({
      kind: "royalty",
      royaltyBasis: "percent",
      royaltyValue: 12,
    }),
    "12% / мин",
  );
  assert.equal(
    formatQuotaRateLabel({
      kind: "royalty",
      royaltyBasis: "flat",
      royaltyValue: 5,
    }),
    "5 LZT/мин",
  );
  assert.equal(
    formatQuotaRateLabel({
      kind: "sponsor",
      sponsorHostPerMinuteLzt: 3,
      sponsorPlayerPerMinuteLzt: 1,
    }),
    "Хост +3 · Игрок +1 LZT/мин",
  );
});

test("buildCreateSessionBody assembles session payload", () => {
  const body = buildCreateSessionBody({
    hostToken: "host-1",
    appName: "Cyberpunk 2077",
    resolution: "1080p",
    bitrateKbps: 8000,
    selectedQuotaId: "q-1",
    accessCode: "ABC",
  });
  assert.deepEqual(body, {
    hostToken: "host-1",
    appName: "Cyberpunk 2077",
    resolution: "1080p",
    bitrateKbps: 8000,
    quotaId: "q-1",
    quotaAccessCode: "ABC",
  });

  const noQuota = buildCreateSessionBody({
    hostToken: "host-1",
    appName: "CS2",
    resolution: "720p",
    bitrateKbps: 5000,
    selectedQuotaId: null,
    accessCode: "",
  });
  assert.equal(noQuota.quotaId, null);
  assert.equal(noQuota.quotaAccessCode, undefined);
});
