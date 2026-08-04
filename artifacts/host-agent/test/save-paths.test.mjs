import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "host-agent-save-paths-"));

/** @type {{ steamRoot: string | null; resolveResult: { appId: string | null; installDir: string | null; steamRoot: string | null } }} */
const steamMock = {
  steamRoot: null,
  resolveResult: { appId: null, installDir: null, steamRoot: null },
};

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return { app: { getPath: () => tmpRoot } };
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

function withWin32(fn) {
  return async () => {
    const origPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "win32" });
    try {
      await fn();
    } finally {
      Object.defineProperty(process, "platform", { value: origPlatform });
    }
  };
}

function writeLoginUsersVdf(steamRoot, steamId64, mostRecent = true) {
  const vdf = `"users"
{
\t"${steamId64}"
\t{
\t\t"MostRecent"\t\t"${mostRecent ? "1" : "0"}"
\t}
}
`;
  const configDir = path.join(steamRoot, "config");
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(path.join(configDir, "loginusers.vdf"), vdf, "utf8");
}

function writeLudusaviCache(bySteamAppId) {
  const cachePath = path.join(tmpRoot, "ludusavi-index.json");
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
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
  const { discoverSavePaths } = await importSavePaths();
  const result = await discoverSavePaths({
    appPath: "C:\\Games\\Foo\\game.exe",
    steamAppId: "12345",
  });
  assert.deepEqual(result, { paths: [], steamAppId: "12345" });
});

test("non-win32: resolveSavePathCandidates returns empty paths", { concurrency: false }, async () => {
  if (process.platform === "win32") return;
  const { resolveSavePathCandidates } = await importSavePaths();
  const result = await resolveSavePathCandidates({
    appPath: "C:\\Games\\Foo\\game.exe",
    steamAppId: "999",
  });
  assert.deepEqual(result, { paths: [], steamAppId: "999" });
});

test(
  "win32: discoverSavePaths finds existing Steam userdata remote folder",
  { concurrency: false },
  withWin32(async () => {
    writeLudusaviCache({});
    const steamRoot = path.join(tmpRoot, "steam-discover");
    const appId = "570";
    const accountId = "12345";
    const steamId64 = (76561197960265728n + BigInt(accountId)).toString();
    const remoteDir = path.join(steamRoot, "userdata", accountId, appId, "remote");
    fs.mkdirSync(remoteDir, { recursive: true });
    fs.writeFileSync(path.join(remoteDir, "save.dat"), "data", "utf8");
    writeLoginUsersVdf(steamRoot, steamId64);

    steamMock.steamRoot = steamRoot;
    steamMock.resolveResult = {
      appId,
      installDir: "C:\\SteamLibrary\\steamapps\\common\\Dota 2",
      steamRoot,
    };

    const { discoverSavePaths } = await importSavePaths();
    const result = await discoverSavePaths({
      appPath: "C:\\SteamLibrary\\steamapps\\common\\Dota 2\\dota2.exe",
    });

    assert.equal(result.steamAppId, appId);
    assert.ok(result.paths.includes(remoteDir));
  }),
);

test(
  "win32: discoverSavePaths resolves Ludusavi template paths from cache",
  { concurrency: false },
  withWin32(async () => {
    const steamRoot = path.join(tmpRoot, "steam-ludusavi");
    const appId = "292030";
    const accountId = "4242";
    const steamId64 = (76561197960265728n + BigInt(accountId)).toString();
    writeLoginUsersVdf(steamRoot, steamId64);

    const home = path.join(tmpRoot, "user-home");
    const saveDir = path.join(home, "Documents", "The Witcher 3", "gamesaves");
    fs.mkdirSync(saveDir, { recursive: true });
    fs.writeFileSync(path.join(saveDir, "slot1.sav"), "x", "utf8");

    const prevHome = process.env.USERPROFILE;
    process.env.USERPROFILE = home;

    writeLudusaviCache({
      [appId]: ["<winDocuments>/The Witcher 3/gamesaves"],
    });

    steamMock.steamRoot = steamRoot;
    steamMock.resolveResult = {
      appId,
      installDir: "C:\\Games\\The Witcher 3",
      steamRoot,
    };

    try {
      const { discoverSavePaths } = await importSavePaths();
      const result = await discoverSavePaths({
        appPath: "C:\\Games\\The Witcher 3\\bin\\witcher3.exe",
        steamAppId: appId,
      });

      assert.equal(result.steamAppId, appId);
      assert.ok(result.paths.some((p) => p.endsWith(path.join("The Witcher 3", "gamesaves"))));
    } finally {
      if (prevHome === undefined) delete process.env.USERPROFILE;
      else process.env.USERPROFILE = prevHome;
    }
  }),
);

test(
  "win32: resolveSavePathCandidates returns candidates when paths do not exist",
  { concurrency: false },
  withWin32(async () => {
    writeLudusaviCache({});
    const steamRoot = path.join(tmpRoot, "steam-restore");
    const appId = "730";
    const accountId = "777";
    const steamId64 = (76561197960265728n + BigInt(accountId)).toString();
    writeLoginUsersVdf(steamRoot, steamId64);

    steamMock.steamRoot = steamRoot;
    steamMock.resolveResult = {
      appId,
      installDir: "C:\\SteamLibrary\\steamapps\\common\\Counter-Strike Global Offensive",
      steamRoot,
    };

    const { resolveSavePathCandidates } = await importSavePaths();
    const result = await resolveSavePathCandidates({
      appPath: "C:\\SteamLibrary\\steamapps\\common\\Counter-Strike Global Offensive\\csgo.exe",
    });

    assert.equal(result.steamAppId, appId);
    assert.ok(result.paths.length >= 2);
    assert.ok(
      result.paths.some((p) => p.includes(path.join("userdata", accountId, appId, "remote"))),
    );
    assert.ok(
      result.paths.some((p) => p.includes(path.join("userdata", accountId, appId, "local"))),
    );
  }),
);

test(
  "win32: uses explicit steamAppId from opts over resolver",
  { concurrency: false },
  withWin32(async () => {
    writeLudusaviCache({});
    const steamRoot = path.join(tmpRoot, "steam-explicit");
    const accountId = "555";
    const steamId64 = (76561197960265728n + BigInt(accountId)).toString();
    const explicitAppId = "440";
    const remoteDir = path.join(steamRoot, "userdata", accountId, explicitAppId, "remote");
    fs.mkdirSync(remoteDir, { recursive: true });
    fs.writeFileSync(path.join(remoteDir, "cloud.sav"), "x", "utf8");
    writeLoginUsersVdf(steamRoot, steamId64);

    steamMock.steamRoot = steamRoot;
    steamMock.resolveResult = {
      appId: "999",
      installDir: "C:\\Games\\TF2",
      steamRoot,
    };

    const { discoverSavePaths } = await importSavePaths();
    const result = await discoverSavePaths({
      appPath: "C:\\Games\\TF2\\hl2.exe",
      steamAppId: explicitAppId,
    });

    assert.equal(result.steamAppId, explicitAppId);
    assert.ok(result.paths.includes(remoteDir));
  }),
);
