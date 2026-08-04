import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import fs from "node:fs";
import { promises as fsp } from "node:fs";
import path from "node:path";
import os from "node:os";

/** Steam ID 76561198000000000 → account id 39734272 */
const STEAM_ID_64 = "76561198000000000";
const STEAM_ACCOUNT_ID = "39734272";
const STEAM_APP_ID = "12345";

let userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "save-paths-"));
let steamMocks = {
  resolveSteamGameFromAppPath: async () => ({
    appId: STEAM_APP_ID,
    installDir: "C:\\Games\\TestGame",
    steamRoot: null,
  }),
  findSteamRootSync: () => null,
};

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
  const parentFile = parent?.filename ?? "";
  if (
    parentFile.endsWith("save-paths.js") &&
    (request === "./steam-scanner" || request.endsWith(`${path.sep}steam-scanner.js`))
  ) {
    return {
      findSteamRootSync: () => steamMocks.findSteamRootSync(),
      resolveSteamGameFromAppPath: (...args) =>
        steamMocks.resolveSteamGameFromAppPath(...args),
    };
  }
  return load.apply(this, arguments);
};

async function importSavePaths() {
  const url = new URL("../dist/main/main/save-paths.js", import.meta.url);
  url.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  return import(url.href);
}

function resetSteamMocks() {
  steamMocks = {
    resolveSteamGameFromAppPath: async () => ({
      appId: STEAM_APP_ID,
      installDir: "C:\\Games\\TestGame",
      steamRoot: null,
    }),
    findSteamRootSync: () => null,
  };
}

async function writeLudusaviCache(templates) {
  const cache = {
    builtAt: new Date().toISOString(),
    bySteamAppId: { [STEAM_APP_ID]: templates },
  };
  await fsp.mkdir(userDataDir, { recursive: true });
  await fsp.writeFile(
    path.join(userDataDir, "ludusavi-index.json"),
    JSON.stringify(cache),
    "utf-8",
  );
}

async function writeLoginUsersVdf(steamRoot) {
  const vdf = `"users"
{
\t"${STEAM_ID_64}"
\t{
\t\t"MostRecent"\t\t"1"
\t}
}
`;
  const configDir = path.join(steamRoot, "config");
  await fsp.mkdir(configDir, { recursive: true });
  await fsp.writeFile(path.join(configDir, "loginusers.vdf"), vdf, "utf-8");
}

async function setupSteamUserdata(steamRoot, subdirs) {
  await writeLoginUsersVdf(steamRoot);
  for (const sub of subdirs) {
    const dir = path.join(
      steamRoot,
      "userdata",
      STEAM_ACCOUNT_ID,
      STEAM_APP_ID,
      sub,
    );
    await fsp.mkdir(dir, { recursive: true });
    await fsp.writeFile(path.join(dir, "save.bin"), "data", "utf-8");
  }
}

test("non-win32: discoverSavePaths returns empty paths", { concurrency: false }, async () => {
  if (process.platform === "win32") return;
  resetSteamMocks();
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "save-paths-"));
  const { discoverSavePaths } = await importSavePaths();

  const result = await discoverSavePaths({
    appPath: "C:\\Games\\TestGame\\game.exe",
    steamAppId: STEAM_APP_ID,
  });

  assert.deepEqual(result, { paths: [], steamAppId: STEAM_APP_ID });
});

test("win32: discoverSavePaths finds existing Steam userdata save dirs", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetSteamMocks();

  const steamRoot = fs.mkdtempSync(path.join(os.tmpdir(), "steam-root-"));
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "save-paths-"));
  await setupSteamUserdata(steamRoot, ["remote", "local"]);
  await writeLudusaviCache([]);

  steamMocks.findSteamRootSync = () => steamRoot;
  steamMocks.resolveSteamGameFromAppPath = async () => ({
    appId: STEAM_APP_ID,
    installDir: "C:\\Games\\TestGame",
    steamRoot,
  });

  const { discoverSavePaths } = await importSavePaths();
  const result = await discoverSavePaths({
    appPath: "C:\\Games\\TestGame\\game.exe",
  });

  assert.equal(result.steamAppId, STEAM_APP_ID);
  assert.equal(result.paths.length, 2);
  assert.ok(result.paths.some((p) => p.endsWith(`${path.sep}remote`)));
  assert.ok(result.paths.some((p) => p.endsWith(`${path.sep}local`)));

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32: discoverSavePaths resolves Ludusavi templates from cache", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetSteamMocks();

  const steamRoot = fs.mkdtempSync(path.join(os.tmpdir(), "steam-root-"));
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "save-paths-"));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "save-home-"));
  const appData = path.join(home, "AppData", "Roaming");
  const saveFile = path.join(appData, "MyGame", "save.dat");
  await fsp.mkdir(path.dirname(saveFile), { recursive: true });
  await fsp.writeFile(saveFile, "save", "utf-8");

  const prevHome = process.env.USERPROFILE;
  const prevAppData = process.env.APPDATA;
  process.env.USERPROFILE = home;
  process.env.APPDATA = appData;

  await writeLoginUsersVdf(steamRoot);
  await writeLudusaviCache(["<winAppData>/MyGame/save.dat"]);

  steamMocks.findSteamRootSync = () => steamRoot;
  steamMocks.resolveSteamGameFromAppPath = async () => ({
    appId: STEAM_APP_ID,
    installDir: "C:\\Games\\TestGame",
    steamRoot,
  });

  const { discoverSavePaths } = await importSavePaths();
  const result = await discoverSavePaths({
    appPath: "C:\\Games\\TestGame\\game.exe",
  });

  assert.ok(result.paths.includes(path.normalize(saveFile)));

  if (prevHome === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = prevHome;
  if (prevAppData === undefined) delete process.env.APPDATA;
  else process.env.APPDATA = prevAppData;
  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32: resolveSavePathCandidates returns paths even when missing", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetSteamMocks();

  const steamRoot = fs.mkdtempSync(path.join(os.tmpdir(), "steam-root-"));
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "save-paths-"));
  await writeLoginUsersVdf(steamRoot);
  await writeLudusaviCache([]);

  steamMocks.findSteamRootSync = () => steamRoot;
  steamMocks.resolveSteamGameFromAppPath = async () => ({
    appId: STEAM_APP_ID,
    installDir: "C:\\Games\\TestGame",
    steamRoot,
  });

  const { resolveSavePathCandidates } = await importSavePaths();
  const result = await resolveSavePathCandidates({
    appPath: "C:\\Games\\TestGame\\game.exe",
    steamAppId: STEAM_APP_ID,
  });

  assert.equal(result.steamAppId, STEAM_APP_ID);
  assert.equal(result.paths.length, 2);
  assert.ok(result.paths.some((p) => p.includes("remote")));
  assert.ok(result.paths.some((p) => p.includes("local")));

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32: opts.steamAppId overrides scanner appId", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetSteamMocks();

  const overrideId = "99999";
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "save-paths-"));
  await writeLudusaviCache(["<base>/saves/*"]);

  steamMocks.resolveSteamGameFromAppPath = async () => ({
    appId: STEAM_APP_ID,
    installDir: "C:\\Games\\Other",
    steamRoot: null,
  });

  const { resolveSavePathCandidates } = await importSavePaths();
  const result = await resolveSavePathCandidates({
    appPath: "C:\\Games\\Other\\game.exe",
    steamAppId: overrideId,
  });

  assert.equal(result.steamAppId, overrideId);
  assert.equal(result.paths.length, 0);

  Object.defineProperty(process, "platform", { value: origPlatform });
});
