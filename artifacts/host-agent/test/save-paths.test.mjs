import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "host-agent-save-paths-"));

let steamMock = {
  steamRoot: null,
  steamMeta: { appId: null, installDir: null, steamRoot: null },
};

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return {
      app: {
        getAppPath: () => tmpRoot,
        getPath: (name) => (name === "userData" ? tmpRoot : tmpRoot),
      },
    };
  }
  if (typeof request === "string" && request.includes("steam-scanner")) {
    return {
      findSteamRootSync: () => steamMock.steamRoot,
      resolveSteamGameFromAppPath: async () => steamMock.steamMeta,
    };
  }
  return load.apply(this, arguments);
};

async function importSavePaths() {
  const url = new URL("../dist/main/main/save-paths.js", import.meta.url);
  url.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  return import(url.href);
}

function resetSteamMock() {
  steamMock = {
    steamRoot: null,
    steamMeta: { appId: null, installDir: null, steamRoot: null },
  };
}

function writeLoginUsers(steamRoot, steamId64) {
  const vdf = `"users"
{
\t"${steamId64}"
\t{
\t\t"MostRecent"\t\t"1"
\t}
}
`;
  const configDir = path.join(steamRoot, "config");
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(path.join(configDir, "loginusers.vdf"), vdf, "utf8");
}

function writeLudusaviCache(bySteamAppId) {
  const cache = {
    builtAt: new Date().toISOString(),
    bySteamAppId,
  };
  fs.writeFileSync(path.join(tmpRoot, "ludusavi-index.json"), JSON.stringify(cache), "utf8");
}

const STEAM_ID_64 = "76561197960265729";
const STEAM_ACCOUNT_ID = "1";

test("non-win32: discoverSavePaths returns empty paths", { concurrency: false }, async () => {
  if (process.platform === "win32") return;
  resetSteamMock();
  const { discoverSavePaths } = await importSavePaths();
  const result = await discoverSavePaths({
    steamAppId: "570",
    appPath: "C:\\Games\\dota\\dota2.exe",
  });
  assert.deepEqual(result, { paths: [], steamAppId: "570" });
});

test("non-win32: resolveSavePathCandidates returns empty paths", { concurrency: false }, async () => {
  if (process.platform === "win32") return;
  resetSteamMock();
  const { resolveSavePathCandidates } = await importSavePaths();
  const result = await resolveSavePathCandidates({
    appPath: "C:\\Games\\dota\\dota2.exe",
  });
  assert.deepEqual(result, { paths: [], steamAppId: null });
});

test("win32: discoverSavePaths finds existing Steam userdata save dirs", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetSteamMock();

  const steamRoot = path.join(tmpRoot, "steam");
  const remoteDir = path.join(
    steamRoot,
    "userdata",
    STEAM_ACCOUNT_ID,
    "570",
    "remote",
  );
  fs.mkdirSync(remoteDir, { recursive: true });

  writeLudusaviCache({});
  writeLoginUsers(steamRoot, STEAM_ID_64);
  steamMock = {
    steamRoot,
    steamMeta: {
      appId: "570",
      installDir: "C:\\SteamLibrary\\steamapps\\common\\dota 2 beta",
      steamRoot,
    },
  };

  const { discoverSavePaths } = await importSavePaths();
  const result = await discoverSavePaths({
    appPath: "C:\\SteamLibrary\\steamapps\\common\\dota 2 beta\\game\\bin\\win64\\dota2.exe",
  });

  assert.equal(result.steamAppId, "570");
  assert.ok(result.paths.some((p) => p.endsWith(path.join("570", "remote"))));

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32: discoverSavePaths resolves Ludusavi templates from cache", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetSteamMock();

  const home = path.join(tmpRoot, "user-home");
  const appData = path.join(home, "AppData", "Roaming");
  const saveDir = path.join(appData, "TestGame", "saves");
  fs.mkdirSync(saveDir, { recursive: true });

  const origEnv = {
    USERPROFILE: process.env.USERPROFILE,
    APPDATA: process.env.APPDATA,
  };
  process.env.USERPROFILE = home;
  process.env.APPDATA = appData;

  writeLudusaviCache({
    999: ["<winAppData>/TestGame/saves/*"],
  });
  steamMock = {
    steamRoot: null,
    steamMeta: { appId: "999", installDir: "C:\\Games\\TestGame", steamRoot: null },
  };

  const { discoverSavePaths } = await importSavePaths();
  const result = await discoverSavePaths({
    steamAppId: "999",
    appPath: "C:\\Games\\TestGame\\game.exe",
  });

  assert.equal(result.steamAppId, "999");
  assert.ok(result.paths.some((p) => p.includes("TestGame") && p.includes("saves")));

  process.env.USERPROFILE = origEnv.USERPROFILE;
  process.env.APPDATA = origEnv.APPDATA;
  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32: resolveSavePathCandidates returns candidates even when missing on disk", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetSteamMock();

  const steamRoot = path.join(tmpRoot, "steam-candidates");
  writeLudusaviCache({});
  writeLoginUsers(steamRoot, STEAM_ID_64);
  steamMock = {
    steamRoot,
    steamMeta: {
      appId: "440",
      installDir: "C:\\SteamLibrary\\steamapps\\common\\Team Fortress 2",
      steamRoot,
    },
  };

  const { resolveSavePathCandidates } = await importSavePaths();
  const result = await resolveSavePathCandidates({
    appPath: "C:\\SteamLibrary\\steamapps\\common\\Team Fortress 2\\hl2.exe",
  });

  assert.equal(result.steamAppId, "440");
  assert.ok(result.paths.length >= 2);
  assert.ok(
    result.paths.some((p) => p.includes(path.join("440", "remote"))),
    "expected remote userdata candidate",
  );
  assert.ok(
    result.paths.some((p) => p.includes(path.join("440", "local"))),
    "expected local userdata candidate",
  );

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32: discoverSavePaths returns empty when no candidates exist", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetSteamMock();
  writeLudusaviCache({});

  steamMock = {
    steamRoot: null,
    steamMeta: { appId: null, installDir: null, steamRoot: null },
  };

  const { discoverSavePaths } = await importSavePaths();
  const result = await discoverSavePaths({
    appPath: "C:\\Games\\Standalone\\game.exe",
  });

  assert.deepEqual(result, { paths: [], steamAppId: null });

  Object.defineProperty(process, "platform", { value: origPlatform });
});
