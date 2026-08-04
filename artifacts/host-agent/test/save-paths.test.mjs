import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync as realExecSync } from "node:child_process";

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "host-agent-save-paths-"));
const steamRoot = path.join(tmpRoot, "Steam");
const userData = path.join(tmpRoot, "userData");
const userProfile = path.join(tmpRoot, "User");
const appData = path.join(userProfile, "AppData", "Roaming");
const localAppData = path.join(userProfile, "AppData", "Local");

fs.mkdirSync(userData, { recursive: true });

const STEAM_ACCOUNT_ID = "12345";
const STEAM_ID64 = (76561197960265728n + BigInt(STEAM_ACCOUNT_ID)).toString();
const STEAM_APP_ID = "570";

function resetSteamLayout() {
  fs.rmSync(steamRoot, { recursive: true, force: true });
}

function writeLoginUsers() {
  const configDir = path.join(steamRoot, "config");
  fs.mkdirSync(configDir, { recursive: true });
  const vdf = `"users"
{
\t"${STEAM_ID64}"
\t{
\t\t"AccountName"\t\t"testuser"
\t\t"MostRecent"\t\t"1"
\t}
}
`;
  fs.writeFileSync(path.join(configDir, "loginusers.vdf"), vdf);
}

function writeLudusaviCache(templates) {
  const cache = {
    builtAt: new Date().toISOString(),
    bySteamAppId: { [STEAM_APP_ID]: templates },
  };
  fs.writeFileSync(path.join(userData, "ludusavi-index.json"), JSON.stringify(cache));
}

function mockSteamRegistry() {
  return (cmd, opts) => {
    if (typeof cmd === "string" && cmd.includes("Valve\\Steam") && cmd.includes("InstallPath")) {
      return `InstallPath    REG_SZ    ${steamRoot}`;
    }
    if (typeof cmd === "string" && cmd.startsWith("reg query")) {
      throw new Error(`unexpected reg query: ${cmd}`);
    }
    return realExecSync(cmd, opts);
  };
}

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return {
      app: {
        getPath: (name) => (name === "userData" ? userData : tmpRoot),
      },
    };
  }
  if (request === "node:child_process") {
    return {
      execSync: mockSteamRegistry(),
      spawn: (...args) => realExecSync(...args),
    };
  }
  return load.apply(this, arguments);
};

async function importSavePaths() {
  const url = new URL("../dist/main/main/save-paths.js", import.meta.url);
  url.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  return import(url.href);
}

function withWin32Env(fn) {
  return async () => {
    const origPlatform = process.platform;
    const envBackup = {
      USERPROFILE: process.env.USERPROFILE,
      APPDATA: process.env.APPDATA,
      LOCALAPPDATA: process.env.LOCALAPPDATA,
    };
    Object.defineProperty(process, "platform", { value: "win32" });
    process.env.USERPROFILE = userProfile;
    process.env.APPDATA = appData;
    process.env.LOCALAPPDATA = localAppData;
    try {
      await fn();
    } finally {
      Object.defineProperty(process, "platform", { value: origPlatform });
      for (const [key, value] of Object.entries(envBackup)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  };
}

test(
  "non-win32: discoverSavePaths returns empty paths",
  { concurrency: false },
  async () => {
    if (process.platform === "win32") return;
    const { discoverSavePaths } = await importSavePaths();
    const result = await discoverSavePaths({
      steamAppId: STEAM_APP_ID,
      appPath: "C:\\Games\\Dota\\dota.exe",
    });
    assert.deepEqual(result, { paths: [], steamAppId: STEAM_APP_ID });
  },
);

test(
  "non-win32: resolveSavePathCandidates returns empty paths",
  { concurrency: false },
  async () => {
    if (process.platform === "win32") return;
    const { resolveSavePathCandidates } = await importSavePaths();
    const result = await resolveSavePathCandidates({
      steamAppId: STEAM_APP_ID,
      appPath: "C:\\Games\\Dota\\dota.exe",
    });
    assert.deepEqual(result, { paths: [], steamAppId: STEAM_APP_ID });
  },
);

test(
  "win32: discoverSavePaths finds existing Steam userdata save dirs",
  { concurrency: false },
  withWin32Env(async () => {
    resetSteamLayout();
    writeLoginUsers();
    const remoteDir = path.join(steamRoot, "userdata", STEAM_ACCOUNT_ID, STEAM_APP_ID, "remote");
    fs.mkdirSync(remoteDir, { recursive: true });
    writeLudusaviCache([]);

    const { discoverSavePaths } = await importSavePaths();
    const result = await discoverSavePaths({
      steamAppId: STEAM_APP_ID,
      appPath: "C:\\Games\\Dota\\dota.exe",
    });

    assert.equal(result.steamAppId, STEAM_APP_ID);
    assert.ok(result.paths.includes(remoteDir));
  }),
);

test(
  "win32: discoverSavePaths resolves Ludusavi templates to existing paths",
  { concurrency: false },
  withWin32Env(async () => {
    resetSteamLayout();
    writeLoginUsers();
    writeLudusaviCache(["<winAppData>/MyGame/saves/*"]);
    const saveDir = path.join(appData, "MyGame", "saves");
    fs.mkdirSync(saveDir, { recursive: true });

    const { discoverSavePaths } = await importSavePaths();
    const result = await discoverSavePaths({
      steamAppId: STEAM_APP_ID,
      appPath: "C:\\Games\\Dota\\dota.exe",
    });

    assert.equal(result.steamAppId, STEAM_APP_ID);
    assert.ok(result.paths.includes(saveDir));
  }),
);

test(
  "win32: resolveSavePathCandidates returns candidates even when missing on disk",
  { concurrency: false },
  withWin32Env(async () => {
    resetSteamLayout();
    writeLoginUsers();
    writeLudusaviCache(["<winLocalAppData>/FutureGame/save-data"]);

    const { resolveSavePathCandidates } = await importSavePaths();
    const result = await resolveSavePathCandidates({
      steamAppId: STEAM_APP_ID,
      appPath: "C:\\Games\\Dota\\dota.exe",
    });

    const expectedRemote = path.join(
      steamRoot,
      "userdata",
      STEAM_ACCOUNT_ID,
      STEAM_APP_ID,
      "remote",
    );
    const expectedLudusavi = path.join(localAppData, "FutureGame", "save-data");

    assert.equal(result.steamAppId, STEAM_APP_ID);
    assert.ok(result.paths.includes(expectedRemote));
    assert.ok(result.paths.includes(expectedLudusavi));
  }),
);

test(
  "win32: uses explicit steamAppId when appPath does not match Steam library",
  { concurrency: false },
  withWin32Env(async () => {
    resetSteamLayout();
    writeLoginUsers();
    writeLudusaviCache([]);
    const localDir = path.join(
      steamRoot,
      "userdata",
      STEAM_ACCOUNT_ID,
      STEAM_APP_ID,
      "local",
    );
    fs.mkdirSync(localDir, { recursive: true });

    const { discoverSavePaths } = await importSavePaths();
    const result = await discoverSavePaths({
      steamAppId: STEAM_APP_ID,
      appPath: "D:\\Standalone\\game.exe",
    });

    assert.equal(result.steamAppId, STEAM_APP_ID);
    assert.ok(result.paths.includes(localDir));
  }),
);
