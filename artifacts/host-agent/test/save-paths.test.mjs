import { test, mock } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "host-agent-save-paths-"));

/** Mutable mocks for steam-scanner (stable object — CJS caches the export). */
const steamMock = {
  resolveSteamGameFromAppPath: async () => ({
    appId: null,
    installDir: null,
    steamRoot: null,
  }),
  findSteamRootSync: () => null,
};

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return {
      app: {
        getPath: () => tmpRoot,
      },
    };
  }
  if (request.endsWith("steam-scanner") || request === "./steam-scanner") {
    return steamMock;
  }
  return load.apply(this, arguments);
};

async function importSavePaths() {
  const url = new URL("../dist/main/main/save-paths.js", import.meta.url);
  url.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  return import(url.href);
}

function resetSteamMock() {
  steamMock.resolveSteamGameFromAppPath = async () => ({
    appId: null,
    installDir: null,
    steamRoot: null,
  });
  steamMock.findSteamRootSync = () => null;
}

function writeLoginUsersVdf(steamRoot, steamId64) {
  const vdf = `"users"
{
\t"${steamId64}"
\t{
\t\t"AccountName"\t\t"testuser"
\t\t"MostRecent"\t\t"1"
\t}
}`;
  fs.mkdirSync(path.join(steamRoot, "config"), { recursive: true });
  fs.writeFileSync(path.join(steamRoot, "config", "loginusers.vdf"), vdf, "utf8");
}

function writeLudusaviCache(bySteamAppId) {
  const cachePath = path.join(tmpRoot, "ludusavi-index.json");
  fs.writeFileSync(
    cachePath,
    JSON.stringify({
      builtAt: new Date().toISOString(),
      bySteamAppId,
    }),
    "utf8",
  );
}

test("non-win32: discoverSavePaths returns empty paths", { concurrency: false }, async () => {
  if (process.platform === "win32") return;
  resetSteamMock();
  const { discoverSavePaths } = await importSavePaths();
  const result = await discoverSavePaths({
    appPath: "C:\\Games\\Foo\\game.exe",
    steamAppId: "12345",
  });
  assert.deepEqual(result, { paths: [], steamAppId: "12345" });
});

test("non-win32: resolveSavePathCandidates returns empty paths", { concurrency: false }, async () => {
  if (process.platform === "win32") return;
  resetSteamMock();
  const { resolveSavePathCandidates } = await importSavePaths();
  const result = await resolveSavePathCandidates({
    appPath: "C:\\Games\\Foo\\game.exe",
    steamAppId: "999",
  });
  assert.deepEqual(result, { paths: [], steamAppId: "999" });
});

test("win32: discoverSavePaths finds existing Steam userdata save dirs", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetSteamMock();

  const steamRoot = path.join(tmpRoot, "steam");
  const steamId64 = "76561198000000000";
  const accountId = "39734272";
  const appId = "570";
  const installDir = path.join(steamRoot, "steamapps", "common", "dota 2");
  const remoteDir = path.join(steamRoot, "userdata", accountId, appId, "remote");
  fs.mkdirSync(remoteDir, { recursive: true });
  fs.writeFileSync(path.join(remoteDir, "cloud.sav"), "data", "utf8");
  writeLoginUsersVdf(steamRoot, steamId64);
  writeLudusaviCache({});

  steamMock.resolveSteamGameFromAppPath = async () => ({
    appId,
    installDir,
    steamRoot,
  });
  steamMock.findSteamRootSync = () => steamRoot;

  const prevUserProfile = process.env.USERPROFILE;
  process.env.USERPROFILE = path.join(tmpRoot, "user");
  fs.mkdirSync(process.env.USERPROFILE, { recursive: true });

  try {
    const { discoverSavePaths } = await importSavePaths();
    const result = await discoverSavePaths({
      appPath: path.join(installDir, "dota2.exe"),
    });
    assert.equal(result.steamAppId, appId);
    assert.ok(result.paths.some((p) => p.endsWith(path.join("remote"))));
  } finally {
    if (prevUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = prevUserProfile;
    Object.defineProperty(process, "platform", { value: origPlatform });
  }
});

test("win32: resolveSavePathCandidates returns userdata candidates when paths missing", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetSteamMock();

  const steamRoot = path.join(tmpRoot, "steam-missing");
  const steamId64 = "76561198000000001";
  const accountId = "39734273";
  const appId = "730";
  const installDir = path.join(steamRoot, "steamapps", "common", "csgo");
  writeLoginUsersVdf(steamRoot, steamId64);
  writeLudusaviCache({});

  steamMock.resolveSteamGameFromAppPath = async () => ({
    appId,
    installDir,
    steamRoot,
  });
  steamMock.findSteamRootSync = () => steamRoot;

  const prevUserProfile = process.env.USERPROFILE;
  process.env.USERPROFILE = path.join(tmpRoot, "user-missing");
  fs.mkdirSync(process.env.USERPROFILE, { recursive: true });

  try {
    const { resolveSavePathCandidates } = await importSavePaths();
    const result = await resolveSavePathCandidates({
      appPath: path.join(installDir, "csgo.exe"),
    });
    assert.equal(result.steamAppId, appId);
    assert.ok(
      result.paths.some((p) => p.endsWith(path.join("userdata", accountId, appId, "remote"))),
    );
    assert.ok(
      result.paths.some((p) => p.endsWith(path.join("userdata", accountId, appId, "local"))),
    );
  } finally {
    if (prevUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = prevUserProfile;
    Object.defineProperty(process, "platform", { value: origPlatform });
  }
});

test("win32: ludusavi cache templates resolve to existing save paths", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetSteamMock();

  const appId = "440";
  const saveDir = path.join(tmpRoot, "saves", "team fortress 2");
  fs.mkdirSync(saveDir, { recursive: true });
  fs.writeFileSync(path.join(saveDir, "save.sav"), "x", "utf8");

  writeLudusaviCache({
    [appId]: ["<winDocuments>/My Games/Team Fortress 2/Save/*"],
  });

  steamMock.resolveSteamGameFromAppPath = async () => ({
    appId,
    installDir: path.join(tmpRoot, "games", "tf2"),
    steamRoot: null,
  });

  const prevUserProfile = process.env.USERPROFILE;
  const userHome = path.join(tmpRoot, "ludusavi-user");
  process.env.USERPROFILE = userHome;
  fs.mkdirSync(path.join(userHome, "Documents", "My Games", "Team Fortress 2", "Save"), {
    recursive: true,
  });
  const docSave = path.join(
    userHome,
    "Documents",
    "My Games",
    "Team Fortress 2",
    "Save",
    "profile.sav",
  );
  fs.writeFileSync(docSave, "profile", "utf8");

  try {
    const { discoverSavePaths } = await importSavePaths();
    const result = await discoverSavePaths({
      appPath: path.join(tmpRoot, "games", "tf2", "hl2.exe"),
      steamAppId: appId,
    });
    assert.equal(result.steamAppId, appId);
    assert.ok(result.paths.some((p) => p.endsWith("profile.sav") || p.includes("Team Fortress 2")));
  } finally {
    if (prevUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = prevUserProfile;
    Object.defineProperty(process, "platform", { value: origPlatform });
  }
});

test("win32: ludusavi manifest fetch failure falls back to stale cache", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetSteamMock();

  const appId = "620";
  const staleBuiltAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const cachePath = path.join(tmpRoot, "ludusavi-index.json");
  fs.writeFileSync(
    cachePath,
    JSON.stringify({
      builtAt: staleBuiltAt,
      bySteamAppId: {
        [appId]: ["<winAppData>/Portal2/save/*"],
      },
    }),
    "utf8",
  );

  const userHome = path.join(tmpRoot, "portal-user");
  const savePath = path.join(userHome, "AppData", "Roaming", "Portal2", "save", "slot1.sav");
  fs.mkdirSync(path.dirname(savePath), { recursive: true });
  fs.writeFileSync(savePath, "slot", "utf8");

  steamMock.resolveSteamGameFromAppPath = async () => ({
    appId,
    installDir: path.join(tmpRoot, "portal"),
    steamRoot: null,
  });

  const prevUserProfile = process.env.USERPROFILE;
  const prevAppData = process.env.APPDATA;
  process.env.USERPROFILE = userHome;
  process.env.APPDATA = path.join(userHome, "AppData", "Roaming");

  const restoreFetch = mock.method(globalThis, "fetch", async () => {
    throw new Error("network down");
  });

  try {
    const { discoverSavePaths } = await importSavePaths();
    const result = await discoverSavePaths({
      appPath: path.join(tmpRoot, "portal", "portal2.exe"),
      steamAppId: appId,
    });
    assert.equal(result.steamAppId, appId);
    assert.ok(result.paths.some((p) => p.endsWith(path.join("Portal2", "save"))));
    assert.equal(restoreFetch.mock.calls.length, 1);
  } finally {
    restoreFetch.mock.restore();
    if (prevUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = prevUserProfile;
    if (prevAppData === undefined) delete process.env.APPDATA;
    else process.env.APPDATA = prevAppData;
    Object.defineProperty(process, "platform", { value: origPlatform });
  }
});
