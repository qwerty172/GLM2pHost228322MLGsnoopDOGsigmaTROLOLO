import { test } from "node:test";
import assert from "node:assert/strict";

const {
  DAYS,
  minutesToHHMM,
  hhmmToMinutes,
  resolveBindingKind,
  validatePrices,
  validateScheduleSlots,
  validateBrowserUrl,
  resolveBindingFields,
  computeDefaultAppLabel,
  mergeTagsWithPending,
  resolveStreamKeyBody,
  buildBindingConfigBody,
} = await import("../src/pages/host/binding-form-helpers.ts");

test("DAYS has 7 Russian day abbreviations starting with Sunday", () => {
  assert.equal(DAYS.length, 7);
  assert.equal(DAYS[0], "Вс");
  assert.equal(DAYS[1], "Пн");
});

test("minutesToHHMM and hhmmToMinutes round-trip", () => {
  assert.equal(minutesToHHMM(0), "00:00");
  assert.equal(minutesToHHMM(90), "01:30");
  assert.equal(minutesToHHMM(1439), "23:59");
  assert.equal(hhmmToMinutes("01:30"), 90);
  assert.equal(hhmmToMinutes("23:59"), 1439);
});

test("hhmmToMinutes clamps invalid input to 0 or max", () => {
  assert.equal(hhmmToMinutes("invalid"), 0);
  assert.equal(hhmmToMinutes("25:00"), 1440);
  assert.equal(hhmmToMinutes("-1:00"), 0);
});

test("resolveBindingKind prefers browser when only URL is set", () => {
  assert.equal(resolveBindingKind("https://game.io", ""), "browser");
  assert.equal(resolveBindingKind("https://game.io", "C:/game.exe"), "app");
  assert.equal(resolveBindingKind("", "C:/game.exe"), "app");
  assert.equal(resolveBindingKind(null, null), "app");
});

test("validatePrices rejects non-finite and out-of-range values", () => {
  assert.equal(validatePrices("0", "0.04"), null);
  assert.equal(validatePrices("-5", "0.04"), null);
  assert.equal(validatePrices("101", "0.04"), "Цена запуска: число, |значение| ≤ 100");
  assert.equal(validatePrices("0", "abc"), "Цена за минуту: число, |значение| ≤ 100");
  assert.equal(validatePrices("0", "-200"), "Цена за минуту: число, |значение| ≤ 100");
});

test("validateScheduleSlots checks empty and out-of-range slots", () => {
  assert.equal(validateScheduleSlots("always", []), null);
  assert.equal(
    validateScheduleSlots("scheduled", [{ day: 1, startMin: 60, endMin: 120 }]),
    null,
  );
  assert.equal(
    validateScheduleSlots("scheduled", [{ day: 1, startMin: 60, endMin: 60 }]),
    "Пустой слот расписания",
  );
  assert.equal(
    validateScheduleSlots("scheduled", [{ day: 1, startMin: -1, endMin: 60 }]),
    "Время слота должно быть в диапазоне 00:00–23:59",
  );
});

test("validateBrowserUrl requires http(s) URL", () => {
  assert.equal(validateBrowserUrl("https://shellshock.io"), null);
  assert.equal(validateBrowserUrl("  https://game.com  "), null);
  assert.equal(validateBrowserUrl(""), "Для браузерной игры нужен URL");
  assert.equal(validateBrowserUrl("ftp://files.com"), "URL должен начинаться с http:// или https://");
  assert.equal(validateBrowserUrl("not-a-url"), "URL должен начинаться с http:// или https://");
});

test("resolveBindingFields clears the inactive binding field", () => {
  assert.deepEqual(resolveBindingFields("app", "C:/game.exe", "https://x"), {
    sendAppPath: "C:/game.exe",
    sendUrl: "",
  });
  assert.deepEqual(resolveBindingFields("browser", "C:/game.exe", " https://x "), {
    sendAppPath: "",
    sendUrl: "https://x",
  });
});

test("computeDefaultAppLabel uses hostname or exe filename", () => {
  assert.equal(computeDefaultAppLabel(true, "https://shellshock.io/play", ""), "shellshock.io");
  assert.equal(computeDefaultAppLabel(true, "bad", ""), "");
  assert.equal(
    computeDefaultAppLabel(false, "", "C:\\Games\\Cyberpunk2077.exe"),
    "Cyberpunk2077.exe",
  );
});

test("mergeTagsWithPending appends uncommitted tag input", () => {
  assert.deepEqual(mergeTagsWithPending(["a"], "b"), ["a", "b"]);
  assert.deepEqual(mergeTagsWithPending(["a"], "  "), ["a"]);
});

test("resolveStreamKeyBody sends empty string to wipe or omits unchanged key", () => {
  assert.deepEqual(resolveStreamKeyBody(true, "secret"), { streamKey: "" });
  assert.deepEqual(resolveStreamKeyBody(false, "secret"), { streamKey: "secret" });
  assert.deepEqual(resolveStreamKeyBody(false, ""), {});
});

test("buildBindingConfigBody assembles update payload", () => {
  const body = buildBindingConfigBody({
    gameId: "g1",
    bindingKind: "browser",
    boundAppPath: "C:/old.exe",
    boundUrl: "https://game.io",
    boundAppLabel: "",
    description: "desc",
    tags: ["pro"],
    tagsInput: "mods",
    launchPriceUsd: "1",
    minutePriceUsd: "0.05",
    scheduleMode: "always",
    scheduleJson: [],
    streamPlatform: "twitch",
    streamUrl: "rtmp://live",
    clearStreamKey: false,
    streamKey: "",
  });
  assert.equal(body.gameId, "g1");
  assert.equal(body.boundAppPath, "");
  assert.equal(body.boundUrl, "https://game.io");
  assert.equal(body.boundAppLabel, "game.io");
  assert.deepEqual(body.tags, ["pro", "mods"]);
  assert.equal(body.launchPriceUsd, 1);
  assert.equal(body.minutePriceUsd, 0.05);
  assert.equal(body.streamPlatform, "twitch");
  assert.equal(body.streamKey, undefined);
});
