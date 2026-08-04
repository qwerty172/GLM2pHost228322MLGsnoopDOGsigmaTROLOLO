import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const STEAM_APP_ID = "570";
const STEAM_ACCOUNT_ID = "12345";
const STEAM_ID64 = "76561197960278073";

let userDataDir;
let homeDir;
let steamRoot;
let installDir;
let steamMeta = {
  appId: STEAM_APP_ID,
  installDir: null,
  steamRoot: null,
};

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return {
      app: {
        getPath: (key) => (key === "userData" ? userDataDir : userDataDir),
      },
    };
  }
  if (
    request === "./steam-scanner" ||
    request.endsWith("/steam-scanner") ||
    request.endsWith("steam-scanner.js")
  ) {
    return {
      findSteamRootSync: () => steamRoot,
      resolveSteamGameFromAppPath: async () => ({
        appId: steamMeta.appId,
        installDir: steamMeta.installDir ?? installDir,
        steamRoot: steamMeta.steamRoot ?? steamRoot,
      }),
    };
  }
  return load.apply(this, arguments);
};

async function importSavePaths() {
  const url = new URL("../dist/main/main/save-paths.js", import.meta.url);
  url.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  return import(url.href);
}

function resetFixture() {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "save-paths-userdata-"));
  homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "save-paths-home-"));
  steamRoot = fs.mkdtempSync(path.join(os.tmpdir(), "save-paths-steam-"));
  installDir = path.join(steamRoot, "steamapps", "common", "dota 2 beta");
  fs.mkdirSync(installDir, { recursive: true });
  steamMeta = {
    appId: STEAM_APP_ID,
    installDir,
    steamRoot,
  };

  const vdf = `"users"
{
  "${STEAM_ID64}"
  {
    "MostRecent" "1"
  }
}
`;
  fs.mkdirSync(path.join(steamRoot, "config"), { recursive: true });
  fs.writeFileSync(path.join(steamRoot, "config", "loginusers.vdf"), vdf);
  writeLudusaviCache();
}

function writeLudusaviCache(templatesByAppId = {}) {
  const cache = {
    builtAt: new Date().toISOString(),
    bySteamAppId: templatesByAppId,
  };
  fs.writeFileSync(path.join(userDataDir, "ludusavi-index.json"), JSON.stringify(cache));
}

async function withWin32Env(fn) {
  const origPlatform = process.platform;
  const origUserProfile = process.env.USERPROFILE;
  const origAppData = process.env.APPDATA;
  const origLocalAppData = process.env.LOCALAPPDATA;
  Object.defineProperty(process, "platform", { value: "win32" });
  process.env.USERPROFILE = homeDir;
  process.env.APPDATA = path.join(homeDir, "AppData", "Roaming");
  process.env.LOCALAPPDATA = path.join(homeDir, "AppData", "Local");
  try {
    return await fn();
  } finally {
    Object.defineProperty(process, "platform", { value: origPlatform });
    if (origUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = origUserProfile;
    if (origAppData === undefined) delete process.env.APPDATA;
    else process.env.APPDATA = origAppData;
    if (origLocalAppData === undefined) delete process.env.LOCALAPPDATA;
    else process.env.LOCALAPPDATA = origLocalAppData;
  }
}

test("non-win32: discoverSavePaths returns empty paths", { concurrency: false }, async () => {
  if (process.platform === "win32") return;
  resetFixture();
  const { discoverSavePaths } = await importSavePaths();
  const result = await discoverSavePaths({
    steamAppId: STEAM_APP_ID,
    appPath: path.join(installDir, "dota2.exe"),
  });
  assert.deepEqual(result, { paths: [], steamAppId: STEAM_APP_ID });
});

test("win32: discovers existing Steam userdata remote/local folders", { concurrency: false }, async () => {
  await withWin32Env(async () => {
    resetFixture();
    const remoteDir = path.join(
      steamRoot,
      "userdata",
      STEAM_ACCOUNT_ID,
      STEAM_APP_ID,
      "remote",
    );
    fs.mkdirSync(remoteDir, { recursive: true });

    const { discoverSavePaths } = await importSavePaths();
    const result = await discoverSavePaths({
      appPath: path.join(installDir, "dota2.exe"),
    });

    assert.equal(result.steamAppId, STEAM_APP_ID);
    assert.ok(result.paths.includes(remoteDir));
  });
});

test("win32: resolves Ludusavi templates from cache and finds existing paths", { concurrency: false }, async () => {
  await withWin32Env(async () => {
    resetFixture();
    const saveDir = path.join(process.env.APPDATA, "Valve", "Saves");
    fs.mkdirSync(saveDir, { recursive: true });
    writeLudusaviCache({ [STEAM_APP_ID]: ["<winAppData>/Valve/Saves/*"] });

    const { discoverSavePaths } = await importSavePaths();
    const result = await discoverSavePaths({
      steamAppId: STEAM_APP_ID,
      appPath: path.join(installDir, "dota2.exe"),
    });

    assert.equal(result.steamAppId, STEAM_APP_ID);
    assert.ok(result.paths.includes(saveDir));
  });
});

test("win32: resolveSavePathCandidates returns templates even when paths are missing", { concurrency: false }, async () => {
  await withWin32Env(async () => {
    resetFixture();
    writeLudusaviCache({ [STEAM_APP_ID]: ["<winLocalAppData>/MissingGame/saves/*"] });

    const expected = path.join(
      process.env.LOCALAPPDATA,
      "MissingGame",
      "saves",
    );

    const { resolveSavePathCandidates } = await importSavePaths();
    const result = await resolveSavePathCandidates({
      steamAppId: STEAM_APP_ID,
      appPath: path.join(installDir, "dota2.exe"),
    });

    assert.equal(result.steamAppId, STEAM_APP_ID);
    assert.ok(result.paths.includes(expected));
  });
});

test("win32: uses explicit steamAppId when Steam metadata has no appId", { concurrency: false }, async () => {
  await withWin32Env(async () => {
    resetFixture();
    steamMeta = { appId: null, installDir, steamRoot };
    const remoteDir = path.join(steamRoot, "userdata", STEAM_ACCOUNT_ID, "999", "remote");
    fs.mkdirSync(remoteDir, { recursive: true });

    const { discoverSavePaths } = await importSavePaths();
    const result = await discoverSavePaths({
      steamAppId: "999",
      appPath: path.join(installDir, "other.exe"),
    });

    assert.equal(result.steamAppId, "999");
    assert.ok(result.paths.includes(remoteDir));
  });
});
