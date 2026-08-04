import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const req = createRequire(import.meta.url);

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "host-agent-save-paths-"));
const steamRoot = path.join(tmpRoot, "steam");
const userDataDir = path.join(tmpRoot, "userData");
const homeDir = path.join(tmpRoot, "home");
const appDataDir = path.join(homeDir, "AppData", "Roaming");
const localAppDataDir = path.join(homeDir, "AppData", "Local");

const STEAM_ID64 = "76561198000000001";
const STEAM_ACCOUNT_ID = "39734273";
const STEAM_APP_ID = "570";

function resetSteamUserdata() {
  fs.rmSync(path.join(steamRoot, "userdata"), { recursive: true, force: true });
}

function writeLoginUsersVdf() {
  const vdf = `"users"
{
\t"${STEAM_ID64}"
\t{
\t\t"MostRecent"\t\t"1"
\t}
}
`;
  fs.mkdirSync(path.join(steamRoot, "config"), { recursive: true });
  fs.writeFileSync(path.join(steamRoot, "config", "loginusers.vdf"), vdf, "utf8");
}

function writeLudusaviCache(templates) {
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.writeFileSync(
    path.join(userDataDir, "ludusavi-index.json"),
    JSON.stringify({
      builtAt: new Date().toISOString(),
      bySteamAppId: templates,
    }),
    "utf8",
  );
}

function steamUserdataBase(kind) {
  return path.join(steamRoot, "userdata", STEAM_ACCOUNT_ID, STEAM_APP_ID, kind);
}

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return {
      app: {
        getAppPath: () => tmpRoot,
        getPath: (name) => (name === "userData" ? userDataDir : tmpRoot),
      },
    };
  }
  if (request.includes("steam-scanner")) {
    return {
      findSteamRootSync: () => steamRoot,
      resolveSteamGameFromAppPath: async () => ({
        appId: STEAM_APP_ID,
        installDir: path.join(tmpRoot, "games", "dota2"),
        steamRoot,
      }),
    };
  }
  return load.apply(this, arguments);
};

async function importSavePaths() {
  const mainDir = path.dirname(req.resolve("../dist/main/main/save-paths.js"));
  for (const id of Object.keys(req.cache)) {
    if (id.startsWith(mainDir)) {
      delete req.cache[id];
    }
  }
  const url = new URL("../dist/main/main/save-paths.js", import.meta.url);
  url.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  return import(url.href);
}

async function withWin32Env(fn) {
  const origPlatform = process.platform;
  const origUserProfile = process.env.USERPROFILE;
  const origAppData = process.env.APPDATA;
  const origLocalAppData = process.env.LOCALAPPDATA;
  Object.defineProperty(process, "platform", { value: "win32" });
  process.env.USERPROFILE = homeDir;
  process.env.APPDATA = appDataDir;
  process.env.LOCALAPPDATA = localAppDataDir;
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
  const { discoverSavePaths } = await importSavePaths();
  const result = await discoverSavePaths({
    appPath: "C:\\Games\\game.exe",
    steamAppId: STEAM_APP_ID,
  });
  assert.deepEqual(result, { paths: [], steamAppId: STEAM_APP_ID });
});

test("win32: discoverSavePaths finds existing Steam userdata save dirs", { concurrency: false }, async () => {
  await withWin32Env(async () => {
    resetSteamUserdata();
    writeLoginUsersVdf();
    const remoteDir = steamUserdataBase("remote");
    fs.mkdirSync(remoteDir, { recursive: true });
    fs.writeFileSync(path.join(remoteDir, "save.dat"), "x", "utf8");
    writeLudusaviCache({});

    const { discoverSavePaths } = await importSavePaths();
    const result = await discoverSavePaths({
      appPath: path.join(tmpRoot, "games", "dota2", "dota2.exe"),
      steamAppId: STEAM_APP_ID,
    });

    assert.equal(result.steamAppId, STEAM_APP_ID);
    assert.ok(result.paths.includes(remoteDir));
  });
});

test("win32: discoverSavePaths resolves Ludusavi templates from cache", { concurrency: false }, async () => {
  await withWin32Env(async () => {
    resetSteamUserdata();
    writeLoginUsersVdf();
    writeLudusaviCache({
      [STEAM_APP_ID]: ["<winAppData>/Dota 2/saves/profile.dat"],
    });

    const saveFile = path.join(appDataDir, "Dota 2", "saves", "profile.dat");
    fs.mkdirSync(path.dirname(saveFile), { recursive: true });
    fs.writeFileSync(saveFile, "save", "utf8");

    const { discoverSavePaths } = await importSavePaths();
    const result = await discoverSavePaths({
      appPath: path.join(tmpRoot, "games", "dota2", "dota2.exe"),
    });

    assert.equal(result.steamAppId, STEAM_APP_ID);
    assert.ok(result.paths.includes(path.normalize(saveFile)));
  });
});

test("win32: resolveSavePathCandidates returns candidates when paths are missing", { concurrency: false }, async () => {
  await withWin32Env(async () => {
    resetSteamUserdata();
    writeLoginUsersVdf();
    writeLudusaviCache({
      [STEAM_APP_ID]: ["<winLocalAppData>/MissingGame/saves/*"],
    });

    const { resolveSavePathCandidates } = await importSavePaths();
    const result = await resolveSavePathCandidates({
      appPath: path.join(tmpRoot, "games", "dota2", "dota2.exe"),
      steamAppId: STEAM_APP_ID,
    });

    const expectedRemote = steamUserdataBase("remote");
    const expectedLocal = steamUserdataBase("local");
    const expectedLudusavi = path.normalize(
      path.join(localAppDataDir, "MissingGame", "saves"),
    );

    assert.equal(result.steamAppId, STEAM_APP_ID);
    assert.ok(result.paths.includes(expectedRemote));
    assert.ok(result.paths.includes(expectedLocal));
    assert.ok(result.paths.includes(expectedLudusavi));
    assert.equal(result.paths.length, 3);
  });
});

test("win32: resolveSavePathCandidates reuses discoverSavePaths when files exist", { concurrency: false }, async () => {
  await withWin32Env(async () => {
    resetSteamUserdata();
    writeLoginUsersVdf();
    const localDir = steamUserdataBase("local");
    fs.mkdirSync(localDir, { recursive: true });
    writeLudusaviCache({});

    const { resolveSavePathCandidates } = await importSavePaths();
    const result = await resolveSavePathCandidates({
      appPath: path.join(tmpRoot, "games", "dota2", "dota2.exe"),
      steamAppId: STEAM_APP_ID,
    });

    assert.deepEqual(result, {
      paths: [localDir],
      steamAppId: STEAM_APP_ID,
    });
  });
});
