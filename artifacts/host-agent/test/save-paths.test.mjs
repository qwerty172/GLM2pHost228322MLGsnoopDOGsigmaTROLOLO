import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const STEAM_ID_64 = "76561197960265729"; // Steam account id 1
const STEAM_APP_ID = "570";

let tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "save-paths-"));
let steamMock = {
  steamRoot: null,
  resolveResult: { appId: null, installDir: null, steamRoot: null },
};

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return {
      app: {
        getPath: (key) => (key === "userData" ? tmpRoot : tmpRoot),
        getAppPath: () => tmpRoot,
      },
    };
  }
  if (typeof request === "string" && request.includes("steam-scanner")) {
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

function resetTmp() {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "save-paths-"));
  steamMock = { steamRoot: null, resolveResult: { appId: null, installDir: null, steamRoot: null } };
}

function writeLoginUsers(steamRoot) {
  const vdf = `"users"
{
\t"${STEAM_ID_64}"
\t{
\t\t"MostRecent"\t\t"1"
\t}
}`;
  fs.mkdirSync(path.join(steamRoot, "config"), { recursive: true });
  fs.writeFileSync(path.join(steamRoot, "config", "loginusers.vdf"), vdf);
}

function writeLudusaviCache(templates) {
  const cache = {
    builtAt: new Date().toISOString(),
    bySteamAppId: {
      [STEAM_APP_ID]: templates,
    },
  };
  fs.writeFileSync(path.join(tmpRoot, "ludusavi-index.json"), JSON.stringify(cache));
}

function setupWin32Env() {
  const home = path.join(tmpRoot, "home");
  const appData = path.join(home, "AppData", "Roaming");
  fs.mkdirSync(appData, { recursive: true });
  process.env.USERPROFILE = home;
  process.env.HOME = home;
  process.env.APPDATA = appData;
  process.env.LOCALAPPDATA = path.join(home, "AppData", "Local");
  return { home, appData };
}

test("non-win32: discoverSavePaths returns empty paths", { concurrency: false }, async () => {
  if (process.platform === "win32") return;
  const { discoverSavePaths } = await importSavePaths();
  const result = await discoverSavePaths({
    appPath: "C:\\Games\\game.exe",
    steamAppId: STEAM_APP_ID,
  });
  assert.deepEqual(result, { paths: [], steamAppId: STEAM_APP_ID });
});

test("win32: discoverSavePaths finds existing Steam userdata paths", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetTmp();
  setupWin32Env();

  const steamRoot = path.join(tmpRoot, "steam");
  writeLoginUsers(steamRoot);
  steamMock.steamRoot = steamRoot;
  steamMock.resolveResult = {
    appId: STEAM_APP_ID,
    installDir: "C:\\Games\\Dota",
    steamRoot,
  };

  const remoteDir = path.join(steamRoot, "userdata", "1", STEAM_APP_ID, "remote");
  const localDir = path.join(steamRoot, "userdata", "1", STEAM_APP_ID, "local");
  fs.mkdirSync(remoteDir, { recursive: true });
  fs.mkdirSync(localDir, { recursive: true });
  writeLudusaviCache([]);

  const { discoverSavePaths } = await importSavePaths();
  const result = await discoverSavePaths({ appPath: "C:\\Games\\Dota\\dota.exe" });

  assert.equal(result.steamAppId, STEAM_APP_ID);
  assert.ok(result.paths.includes(remoteDir));
  assert.ok(result.paths.includes(localDir));

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32: discoverSavePaths resolves Ludusavi template paths", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetTmp();
  const { appData } = setupWin32Env();

  const steamRoot = path.join(tmpRoot, "steam");
  writeLoginUsers(steamRoot);
  steamMock.steamRoot = steamRoot;
  steamMock.resolveResult = {
    appId: STEAM_APP_ID,
    installDir: "C:\\Games\\Dota",
    steamRoot,
  };

  const ludusaviSave = path.join(appData, "MyGame", "saves");
  fs.mkdirSync(ludusaviSave, { recursive: true });
  writeLudusaviCache(["<winAppData>/MyGame/saves"]);

  const { discoverSavePaths } = await importSavePaths();
  const result = await discoverSavePaths({ appPath: "C:\\Games\\Dota\\dota.exe" });

  assert.ok(result.paths.includes(ludusaviSave));

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32: resolveSavePathCandidates returns candidates when paths missing", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetTmp();
  setupWin32Env();

  const steamRoot = path.join(tmpRoot, "steam");
  writeLoginUsers(steamRoot);
  steamMock.steamRoot = steamRoot;
  steamMock.resolveResult = {
    appId: STEAM_APP_ID,
    installDir: "C:\\Games\\Dota",
    steamRoot,
  };
  writeLudusaviCache([]);

  const remoteDir = path.join(steamRoot, "userdata", "1", STEAM_APP_ID, "remote");
  const localDir = path.join(steamRoot, "userdata", "1", STEAM_APP_ID, "local");

  const { resolveSavePathCandidates } = await importSavePaths();
  const result = await resolveSavePathCandidates({ appPath: "C:\\Games\\Dota\\dota.exe" });

  assert.equal(result.steamAppId, STEAM_APP_ID);
  assert.ok(result.paths.includes(remoteDir));
  assert.ok(result.paths.includes(localDir));
  assert.equal(result.paths.length, 2);

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32: uses explicit steamAppId override", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetTmp();
  setupWin32Env();

  const steamRoot = path.join(tmpRoot, "steam");
  const overrideAppId = "999";
  writeLoginUsers(steamRoot);
  steamMock.steamRoot = steamRoot;
  steamMock.resolveResult = {
    appId: STEAM_APP_ID,
    installDir: "C:\\Games\\Dota",
    steamRoot,
  };

  const overrideDir = path.join(steamRoot, "userdata", "1", overrideAppId, "remote");
  fs.mkdirSync(overrideDir, { recursive: true });
  writeLudusaviCache([]);

  const { discoverSavePaths } = await importSavePaths();
  const result = await discoverSavePaths({
    appPath: "C:\\Games\\Dota\\dota.exe",
    steamAppId: overrideAppId,
  });

  assert.equal(result.steamAppId, overrideAppId);
  assert.ok(result.paths.includes(overrideDir));
  assert.ok(!result.paths.some((p) => p.includes(STEAM_APP_ID)));

  Object.defineProperty(process, "platform", { value: origPlatform });
});
