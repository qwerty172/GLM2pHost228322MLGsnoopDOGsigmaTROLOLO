import { test } from "node:test";
import assert from "node:assert/strict";

const {
  LZT_PER_USD,
  lztToUsd,
  resolveEntryKind,
  isWindowsPath,
  validateLibraryAppPath,
  parsePricePerMinuteLzt,
  normalizeLibraryConfigValues,
  isValidSteamAppId,
  getAddModalTitle,
  buildCatalogSearchParams,
  formatCatalogGameMeta,
  isBrowserCatalogGame,
  resolveDeleteConflictStatus,
} = await import("../src/pages/host/library-helpers.ts");

test("LZT_PER_USD and lztToUsd convert LZT to USD string", () => {
  assert.equal(LZT_PER_USD, 200);
  assert.equal(lztToUsd(200), "1.00");
  assert.equal(lztToUsd(8), "0.04");
  assert.equal(lztToUsd(0), "0.00");
});

test("resolveEntryKind detects browser entries by boundUrl or catalog browserHostUrl", () => {
  assert.equal(
    resolveEntryKind({ boundUrl: "https://game.io", game: {} }),
    "browser",
  );
  assert.equal(
    resolveEntryKind({ boundUrl: "", game: { browserHostUrl: "https://game.io" } }),
    "browser",
  );
  assert.equal(
    resolveEntryKind({ boundUrl: "", game: { browserHostUrl: null } }),
    "native",
  );
});

test("isWindowsPath accepts drive, UNC and POSIX paths", () => {
  assert.equal(isWindowsPath("C:\\Games\\game.exe"), true);
  assert.equal(isWindowsPath("\\\\server\\share\\game.exe"), true);
  assert.equal(isWindowsPath("/usr/games/binary"), true);
  assert.equal(isWindowsPath("relative/path"), false);
  assert.equal(isWindowsPath("https://game.io"), false);
});

test("validateLibraryAppPath allows empty path and rejects invalid formats", () => {
  assert.equal(validateLibraryAppPath(""), null);
  assert.equal(validateLibraryAppPath("   "), null);
  assert.equal(validateLibraryAppPath("C:\\Games\\game.exe"), null);
  assert.match(validateLibraryAppPath("game.exe"), /Путь должен выглядеть/);
});

test("parsePricePerMinuteLzt clamps negative and non-numeric input to zero", () => {
  assert.equal(parsePricePerMinuteLzt("8"), 8);
  assert.equal(parsePricePerMinuteLzt("-5"), 0);
  assert.equal(parsePricePerMinuteLzt("abc"), 0);
  assert.equal(parsePricePerMinuteLzt(""), 0);
});

test("normalizeLibraryConfigValues splits native and browser fields", () => {
  const native = normalizeLibraryConfigValues({
    isBrowser: false,
    price: "12",
    appPath: " C:\\Games\\game.exe ",
    boundUrl: "https://ignored",
    launchArgs: " -windowed ",
  });
  assert.equal(native.pathError, null);
  assert.deepEqual(native.values, {
    pricePerMinuteLzt: 12,
    appPath: "C:\\Games\\game.exe",
    boundUrl: "",
    launchArgs: "-windowed",
  });

  const browser = normalizeLibraryConfigValues({
    isBrowser: true,
    price: "5",
    appPath: "C:\\ignored.exe",
    boundUrl: " https://shell.io ",
    launchArgs: "",
  });
  assert.equal(browser.pathError, null);
  assert.deepEqual(browser.values, {
    pricePerMinuteLzt: 5,
    appPath: "",
    boundUrl: "https://shell.io",
    launchArgs: "",
  });
});

test("normalizeLibraryConfigValues returns path error for invalid native path", () => {
  const result = normalizeLibraryConfigValues({
    isBrowser: false,
    price: "8",
    appPath: "invalid.exe",
    boundUrl: "",
    launchArgs: "",
  });
  assert.ok(result.pathError);
  assert.equal(result.values.appPath, "invalid.exe");
});

test("isValidSteamAppId accepts only numeric IDs", () => {
  assert.equal(isValidSteamAppId("730"), true);
  assert.equal(isValidSteamAppId("  570  "), true);
  assert.equal(isValidSteamAppId(""), false);
  assert.equal(isValidSteamAppId("abc"), false);
  assert.equal(isValidSteamAppId("12a"), false);
});

test("getAddModalTitle reflects pending submission state", () => {
  assert.equal(getAddModalTitle("search", null), "Добавить игру в библиотеку");
  assert.equal(getAddModalTitle("config", null), "Настройка запуска");
  assert.equal(
    getAddModalTitle("config", "sub-1"),
    "Настройка запуска (ожидает модерации)",
  );
  assert.equal(getAddModalTitle("suggest", null), "Предложить новую игру");
});

test("buildCatalogSearchParams omits empty search", () => {
  assert.deepEqual(buildCatalogSearchParams(""), {});
  assert.deepEqual(buildCatalogSearchParams("  "), {});
  assert.deepEqual(buildCatalogSearchParams("  cyber  "), { search: "cyber" });
});

test("formatCatalogGameMeta joins category, genre and genres", () => {
  assert.equal(
    formatCatalogGameMeta("Action", "Shooter", ["FPS", "Multiplayer"]),
    "Action · Shooter · FPS, Multiplayer",
  );
  assert.equal(formatCatalogGameMeta(null, null, null), "Без категории");
});

test("isBrowserCatalogGame checks browserHostUrl presence", () => {
  assert.equal(isBrowserCatalogGame({ browserHostUrl: "https://x" }), true);
  assert.equal(isBrowserCatalogGame({ browserHostUrl: null }), false);
  assert.equal(isBrowserCatalogGame({}), false);
});

test("resolveDeleteConflictStatus extracts HTTP status from API errors", () => {
  assert.equal(resolveDeleteConflictStatus({ status: 409 }), 409);
  assert.equal(resolveDeleteConflictStatus(new Error("fail")), 0);
  assert.equal(resolveDeleteConflictStatus(null), 0);
});
