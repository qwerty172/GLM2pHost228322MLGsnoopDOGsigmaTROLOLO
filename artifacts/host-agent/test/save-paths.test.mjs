import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

/** Steam account id for 76561197960278073 (offset + 12345). */
const STEAM_ACCOUNT_ID = "12345";
const STEAM_ID64 = "76561197960278073";
const STEAM_APP_ID = "480";

let env = createTestEnv();
let steamMock = defaultSteamMock(env);

function createTestEnv() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "host-agent-save-paths-"));
  return {
    tmpRoot,
    homeDir: path.join(tmpRoot, "home"),
    steamRoot: path.join(tmpRoot, "steam"),
    userDataDir: path.join(tmpRoot, "userData"),
  };
}

function defaultSteamMock(testEnv) {
  return {
    resolveResult: {
      appId: STEAM_APP_ID,
      installDir: "C:\\Games\\TestGame",
      steamRoot: testEnv.steamRoot,
    },
    steamRoot: testEnv.steamRoot,
  };
}

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return {
      app: {
        getPath: (name) => (name === "userData" ? env.userDataDir : env.tmpRoot),
      },
    };
  }
  if (request === "./steam-scanner" && parent?.filename?.includes("save-paths")) {
    return {
      resolveSteamGameFromAppPath: async () => steamMock.resolveResult,
      findSteamRootSync: () => steamMock.steamRoot,
    };
  }
  return load.apply(this, arguments);
};

async function importSavePaths() {
  const url = new URL("../dist/main/main/save-paths.js", import.meta.url);
  url.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  return import(url.href);
}

function writeLudusaviCache(bySteamAppId) {
  fs.mkdirSync(env.userDataDir, { recursive: true });
  fs.writeFileSync(
    path.join(env.userDataDir, "ludusavi-index.json"),
    JSON.stringify({
      builtAt: new Date().toISOString(),
      bySteamAppId,
    }),
    "utf-8",
  );
}

function writeLoginUsersVdf() {
  fs.mkdirSync(path.join(env.steamRoot, "config"), { recursive: true });
  fs.writeFileSync(
    path.join(env.steamRoot, "config", "loginusers.vdf"),
    `"users"
{
  "${STEAM_ID64}"
  {
    "AccountName" "testuser"
    "MostRecent" "1"
  }
}
`,
    "utf-8",
  );
}

function withWin32(fn) {
  const origPlatform = process.platform;
  const origUserProfile = process.env.USERPROFILE;
  const origAppData = process.env.APPDATA;
  const origLocalAppData = process.env.LOCALAPPDATA;

  Object.defineProperty(process, "platform", { value: "win32" });
  process.env.USERPROFILE = env.homeDir;
  process.env.APPDATA = path.join(env.homeDir, "AppData", "Roaming");
  process.env.LOCALAPPDATA = path.join(env.homeDir, "AppData", "Local");

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      Object.defineProperty(process, "platform", { value: origPlatform });
      if (origUserProfile === undefined) delete process.env.USERPROFILE;
      else process.env.USERPROFILE = origUserProfile;
      if (origAppData === undefined) delete process.env.APPDATA;
      else process.env.APPDATA = origAppData;
      if (origLocalAppData === undefined) delete process.env.LOCALAPPDATA;
      else process.env.LOCALAPPDATA = origLocalAppData;
    });
}

beforeEach(() => {
  env = createTestEnv();
  steamMock = defaultSteamMock(env);
});

test("non-win32: discoverSavePaths returns empty paths", { concurrency: false }, async () => {
  if (process.platform === "win32") return;
  const { discoverSavePaths } = await importSavePaths();
  const result = await discoverSavePaths({
    steamAppId: "999",
    appPath: "C:\\Games\\game.exe",
  });
  assert.deepEqual(result, { paths: [], steamAppId: "999" });
});

test("non-win32: resolveSavePathCandidates returns empty paths", { concurrency: false }, async () => {
  if (process.platform === "win32") return;
  const { resolveSavePathCandidates } = await importSavePaths();
  const result = await resolveSavePathCandidates({
    steamAppId: "999",
    appPath: "C:\\Games\\game.exe",
  });
  assert.deepEqual(result, { paths: [], steamAppId: "999" });
});

test("win32: discoverSavePaths finds existing Steam userdata paths", { concurrency: false }, async () =>
  withWin32(async () => {
    writeLoginUsersVdf();
    writeLudusaviCache({});

    const remoteDir = path.join(
      env.steamRoot,
      "userdata",
      STEAM_ACCOUNT_ID,
      STEAM_APP_ID,
      "remote",
    );
    fs.mkdirSync(remoteDir, { recursive: true });
    fs.writeFileSync(path.join(remoteDir, "save.dat"), "data", "utf-8");

    const { discoverSavePaths } = await importSavePaths();
    const result = await discoverSavePaths({
      appPath: "C:\\Games\\TestGame\\game.exe",
    });

    assert.equal(result.steamAppId, STEAM_APP_ID);
    assert.ok(result.paths.some((p) => p.endsWith(path.join("remote"))));
    assert.ok(result.paths.some((p) => p.includes("save.dat") || p.endsWith("remote")));
  }),
);

test("win32: discoverSavePaths resolves Ludusavi templates for existing paths", { concurrency: false }, async () =>
  withWin32(async () => {
    writeLoginUsersVdf();
    const ludusaviSaveDir = path.join(env.homeDir, "AppData", "Roaming", "MyGame", "saves");
    fs.mkdirSync(ludusaviSaveDir, { recursive: true });
    fs.writeFileSync(path.join(ludusaviSaveDir, "slot1.sav"), "x", "utf-8");

    writeLudusaviCache({
      [STEAM_APP_ID]: ["<winAppData>/MyGame/saves/*"],
    });

    const { discoverSavePaths } = await importSavePaths();
    const result = await discoverSavePaths({
      appPath: "C:\\Games\\TestGame\\game.exe",
    });

    assert.ok(
      result.paths.some((p) => p.replace(/\\/g, "/").includes("MyGame/saves")),
      `expected Ludusavi path in ${JSON.stringify(result.paths)}`,
    );
  }),
);

test("win32: resolveSavePathCandidates returns candidates when paths do not exist", { concurrency: false }, async () =>
  withWin32(async () => {
    writeLoginUsersVdf();
    writeLudusaviCache({
      [STEAM_APP_ID]: ["<winLocalAppData>/GameSaves"],
    });

    const { resolveSavePathCandidates } = await importSavePaths();
    const result = await resolveSavePathCandidates({
      appPath: "C:\\Games\\TestGame\\game.exe",
    });

    assert.equal(result.steamAppId, STEAM_APP_ID);
    assert.ok(result.paths.length > 0);
    assert.ok(
      result.paths.some((p) => p.replace(/\\/g, "/").includes("userdata/12345/480")),
    );
    assert.ok(
      result.paths.some((p) => p.replace(/\\/g, "/").includes("GameSaves")),
    );
  }),
);

test("win32: resolveSavePathCandidates returns discovered paths when they exist", { concurrency: false }, async () =>
  withWin32(async () => {
    writeLoginUsersVdf();
    writeLudusaviCache({});

    const localDir = path.join(
      env.steamRoot,
      "userdata",
      STEAM_ACCOUNT_ID,
      STEAM_APP_ID,
      "local",
    );
    fs.mkdirSync(localDir, { recursive: true });

    const { discoverSavePaths, resolveSavePathCandidates } = await importSavePaths();
    const discovered = await discoverSavePaths({
      appPath: "C:\\Games\\TestGame\\game.exe",
    });
    const resolved = await resolveSavePathCandidates({
      appPath: "C:\\Games\\TestGame\\game.exe",
    });

    assert.deepEqual(resolved, discovered);
    assert.ok(resolved.paths.some((p) => p.endsWith("local")));
  }),
);

test("win32: opts.steamAppId overrides steam-scanner appId", { concurrency: false }, async () =>
  withWin32(async () => {
    steamMock.resolveResult = { appId: null, installDir: null, steamRoot: null };
    writeLoginUsersVdf();
    writeLudusaviCache({});

    const overrideId = "730";
    const userdataDir = path.join(env.steamRoot, "userdata", STEAM_ACCOUNT_ID, overrideId, "remote");
    fs.mkdirSync(userdataDir, { recursive: true });

    const { discoverSavePaths } = await importSavePaths();
    const result = await discoverSavePaths({
      steamAppId: overrideId,
      appPath: "C:\\Games\\cs2\\game.exe",
    });

    assert.equal(result.steamAppId, overrideId);
    assert.ok(result.paths.some((p) => p.includes(overrideId)));
  }),
);

test("win32: skips Ludusavi paths gated to non-windows platforms", { concurrency: false }, async () =>
  withWin32(async () => {
    writeLoginUsersVdf();
    const linuxOnlyDir = path.join(env.homeDir, "AppData", "Roaming", "LinuxOnly");
    fs.mkdirSync(linuxOnlyDir, { recursive: true });

    writeLudusaviCache({
      [STEAM_APP_ID]: ["<winAppData>/LinuxOnly"],
    });

    const manifestYaml = `
game_linux:
  steam:
    id: ${STEAM_APP_ID}
  files:
    "<winAppData>/LinuxOnly":
      tags: [save]
      when:
        - os: linux
game_win:
  steam:
    id: ${STEAM_APP_ID}
  files:
    "<winAppData>/WinOnly":
      tags: [save]
      when:
        - os: windows
`;
    const winOnlyDir = path.join(env.homeDir, "AppData", "Roaming", "WinOnly");
    fs.mkdirSync(winOnlyDir, { recursive: true });

    const cachePath = path.join(env.userDataDir, "ludusavi-index.json");
    fs.mkdirSync(env.userDataDir, { recursive: true });
    fs.writeFileSync(
      cachePath,
      JSON.stringify({
        builtAt: "2000-01-01T00:00:00.000Z",
        bySteamAppId: { [STEAM_APP_ID]: ["<winAppData>/LinuxOnly"] },
      }),
      "utf-8",
    );

    const origFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      text: async () => manifestYaml,
    });

    try {
      const { discoverSavePaths } = await importSavePaths();
      const result = await discoverSavePaths({
        appPath: "C:\\Games\\TestGame\\game.exe",
      });

      const normalized = result.paths.map((p) => p.replace(/\\/g, "/"));
      assert.ok(normalized.some((p) => p.includes("WinOnly")), normalized.join(", "));
      assert.ok(!normalized.some((p) => p.includes("LinuxOnly")), normalized.join(", "));
    } finally {
      globalThis.fetch = origFetch;
    }
  }),
);
