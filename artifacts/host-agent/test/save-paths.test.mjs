// Unit tests for Steam/Ludusavi save path discovery (save-paths.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

/** Mutable steam-scanner mock state. */
let steamMock = {
  steamRoot: null,
  resolveResult: { appId: null, installDir: null, steamRoot: null },
};

let userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "save-paths-userdata-"));
let steamRootDir = fs.mkdtempSync(path.join(os.tmpdir(), "save-paths-steam-"));

const STEAM_ID_OFFSET = 76561197960265728n;
const TEST_ACCOUNT_ID = "12345";
const TEST_STEAM_ID64 = (STEAM_ID_OFFSET + BigInt(TEST_ACCOUNT_ID)).toString();

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return {
      app: {
        getPath: (key) => (key === "userData" ? userDataDir : userDataDir),
        getAppPath: () => userDataDir,
      },
    };
  }
  if (request === "./steam-scanner") {
    return {
      findSteamRootSync: () => steamMock.steamRoot,
      resolveSteamGameFromAppPath: async () => steamMock.resolveResult,
    };
  }
  return load.apply(this, arguments);
};

async function importSavePaths() {
  const url = new URL("../dist/main/main/save-paths.js", import.meta.url);
  url.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  return import(url.href);
}

function resetDirs() {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "save-paths-userdata-"));
  steamRootDir = fs.mkdtempSync(path.join(os.tmpdir(), "save-paths-steam-"));
  steamMock = {
    steamRoot: steamRootDir,
    resolveResult: {
      appId: "570",
      installDir: "C:\\SteamLibrary\\steamapps\\common\\dota 2 beta",
      steamRoot: steamRootDir,
    },
  };
}

function writeLoginUsersVdf(steamRoot, steamId64, mostRecent = "1") {
  const vdf = `"users"
{
\t"${steamId64}"
\t{
\t\t"AccountName"\t\t"testuser"
\t\t"MostRecent"\t\t"${mostRecent}"
\t}
}
`;
  const configDir = path.join(steamRoot, "config");
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(path.join(configDir, "loginusers.vdf"), vdf, "utf8");
}

function writeLudusaviCache(templatesByAppId) {
  const cache = {
    builtAt: new Date().toISOString(),
    bySteamAppId: templatesByAppId,
  };
  fs.writeFileSync(
    path.join(userDataDir, "ludusavi-index.json"),
    JSON.stringify(cache),
    "utf8",
  );
}

function ensureSteamUserdata(appId, subdirs = ["remote"]) {
  const base = path.join(steamRootDir, "userdata", TEST_ACCOUNT_ID, appId);
  for (const sub of subdirs) {
    const dir = path.join(base, sub);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "save.dat"), "data", "utf8");
  }
  return base;
}

test("non-win32: discoverSavePaths returns empty paths", { concurrency: false }, async () => {
  if (process.platform === "win32") return;
  resetDirs();
  const { discoverSavePaths } = await importSavePaths();
  const result = await discoverSavePaths({
    appPath: "C:\\Games\\game.exe",
    steamAppId: "570",
  });
  assert.deepEqual(result, { paths: [], steamAppId: "570" });
});

test("non-win32: resolveSavePathCandidates returns empty paths", { concurrency: false }, async () => {
  if (process.platform === "win32") return;
  resetDirs();
  const { resolveSavePathCandidates } = await importSavePaths();
  const result = await resolveSavePathCandidates({
    appPath: "C:\\Games\\game.exe",
    steamAppId: "570",
  });
  assert.deepEqual(result, { paths: [], steamAppId: "570" });
});

test("win32: discoverSavePaths finds existing Steam userdata save dirs", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetDirs();
  writeLoginUsersVdf(steamRootDir, TEST_STEAM_ID64);
  writeLudusaviCache({});
  const userdataBase = ensureSteamUserdata("570", ["remote", "local"]);

  const { discoverSavePaths } = await importSavePaths();
  const result = await discoverSavePaths({
    appPath: "C:\\SteamLibrary\\steamapps\\common\\dota 2 beta\\dota2.exe",
  });

  assert.equal(result.steamAppId, "570");
  assert.equal(result.paths.length, 2);
  assert.ok(result.paths.includes(path.join(userdataBase, "remote")));
  assert.ok(result.paths.includes(path.join(userdataBase, "local")));

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32: discoverSavePaths resolves Ludusavi templates from cache", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetDirs();
  writeLoginUsersVdf(steamRootDir, TEST_STEAM_ID64);

  const appData = path.join(userDataDir, "AppData", "Roaming");
  const saveDir = path.join(appData, "TestGame", "saves");
  fs.mkdirSync(saveDir, { recursive: true });
  fs.writeFileSync(path.join(saveDir, "slot1.sav"), "x", "utf8");

  writeLudusaviCache({
    570: ["<winAppData>/TestGame/saves/*"],
  });

  const prevAppData = process.env.APPDATA;
  const prevHome = process.env.USERPROFILE;
  process.env.APPDATA = appData;
  process.env.USERPROFILE = userDataDir;

  try {
    const { discoverSavePaths } = await importSavePaths();
    const result = await discoverSavePaths({
      appPath: "C:\\SteamLibrary\\steamapps\\common\\dota 2 beta\\dota2.exe",
      steamAppId: "570",
    });

    assert.equal(result.steamAppId, "570");
    assert.ok(result.paths.includes(saveDir));
  } finally {
    if (prevAppData === undefined) delete process.env.APPDATA;
    else process.env.APPDATA = prevAppData;
    if (prevHome === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = prevHome;
    Object.defineProperty(process, "platform", { value: origPlatform });
  }
});

test("win32: resolveSavePathCandidates returns candidates when paths do not exist", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetDirs();
  writeLoginUsersVdf(steamRootDir, TEST_STEAM_ID64);
  writeLudusaviCache({
    570: ["<winAppData>/MissingGame/saves/*"],
  });

  const prevAppData = process.env.APPDATA;
  process.env.APPDATA = path.join(userDataDir, "AppData", "Roaming");

  try {
    const { resolveSavePathCandidates } = await importSavePaths();
    const result = await resolveSavePathCandidates({
      appPath: "C:\\SteamLibrary\\steamapps\\common\\dota 2 beta\\dota2.exe",
      steamAppId: "570",
    });

    const expectedRemote = path.join(
      steamRootDir,
      "userdata",
      TEST_ACCOUNT_ID,
      "570",
      "remote",
    );
    const expectedLocal = path.join(
      steamRootDir,
      "userdata",
      TEST_ACCOUNT_ID,
      "570",
      "local",
    );
    const expectedLudusavi = path.join(
      process.env.APPDATA,
      "MissingGame",
      "saves",
    );

    assert.equal(result.steamAppId, "570");
    assert.ok(result.paths.includes(expectedRemote));
    assert.ok(result.paths.includes(expectedLocal));
    assert.ok(result.paths.includes(expectedLudusavi));
  } finally {
    if (prevAppData === undefined) delete process.env.APPDATA;
    else process.env.APPDATA = prevAppData;
    Object.defineProperty(process, "platform", { value: origPlatform });
  }
});

test("win32: uses explicit steamAppId override", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetDirs();
  steamMock.resolveResult = { appId: "999", installDir: null, steamRoot: steamRootDir };
  writeLoginUsersVdf(steamRootDir, TEST_STEAM_ID64);
  writeLudusaviCache({});
  const userdataBase = ensureSteamUserdata("440", ["remote"]);

  const { discoverSavePaths } = await importSavePaths();
  const result = await discoverSavePaths({
    appPath: "C:\\Games\\tf2.exe",
    steamAppId: "440",
  });

  assert.equal(result.steamAppId, "440");
  assert.deepEqual(result.paths, [path.join(userdataBase, "remote")]);

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32: skips Ludusavi entries filtered by non-windows when", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetDirs();
  writeLoginUsersVdf(steamRootDir, TEST_STEAM_ID64);

  const linuxOnlyDir = path.join(userDataDir, "linux-only");
  fs.mkdirSync(linuxOnlyDir, { recursive: true });

  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    text: async () => `
Game A:
  steam:
    id: 570
  files:
    "<home>/linux-only":
      tags: [save]
      when:
        - os: linux
    "<home>/win-save":
      tags: [save]
      when:
        - os: windows
`,
  });

  const winSaveDir = path.join(userDataDir, "win-save");
  fs.mkdirSync(winSaveDir, { recursive: true });
  fs.writeFileSync(path.join(winSaveDir, "save.dat"), "x", "utf8");

  const prevHome = process.env.USERPROFILE;
  process.env.USERPROFILE = userDataDir;

  try {
    const { discoverSavePaths } = await importSavePaths();
    const result = await discoverSavePaths({
      appPath: "C:\\Games\\game.exe",
      steamAppId: "570",
    });

    assert.ok(!result.paths.some((p) => p.includes("linux-only")));
    assert.ok(result.paths.some((p) => p.includes("win-save")));
  } finally {
    globalThis.fetch = origFetch;
    if (prevHome === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = prevHome;
    Object.defineProperty(process, "platform", { value: origPlatform });
  }
});
