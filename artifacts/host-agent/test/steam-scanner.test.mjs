import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "host-agent-steam-scanner-"));

/** @type {string | null} */
let registrySteamPath = null;

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return { app: { getPath: () => tmpRoot } };
  }
  if (request === "node:child_process") {
    const orig = load.apply(this, arguments);
    return {
      ...orig,
      execSync: (cmd) => {
        const m = String(cmd).match(/reg query "([^"]+)" \/v "([^"]+)"/);
        if (m && registrySteamPath && m[1].includes("Valve\\Steam")) {
          return `    ${m[2]}    REG_SZ    ${registrySteamPath}\n`;
        }
        throw new Error("reg query failed");
      },
    };
  }
  return load.apply(this, arguments);
};

async function importSteamScanner() {
  const url = new URL("../dist/main/main/steam-scanner.js", import.meta.url);
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

function resetRegistry() {
  registrySteamPath = null;
}

function writeLibraryFoldersVdf(steamRoot, extraFolders = []) {
  const entries = extraFolders
    .map(
      (folder, idx) => `\t"${idx}"
\t{
\t\t"path"\t\t"${folder.replace(/\\/g, "\\\\")}"
\t}`,
    )
    .join("\n");
  const vdf = `"libraryfolders"
{
${entries}
}
`;
  const dir = path.join(steamRoot, "steamapps");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "libraryfolders.vdf"), vdf, "utf8");
}

function writeAppManifest(
  steamRoot,
  { appId, name, installDir, userConfigExe = null },
) {
  const steamappsDir = path.join(steamRoot, "steamapps");
  fs.mkdirSync(steamappsDir, { recursive: true });

  let userConfigBlock = "";
  if (userConfigExe) {
    userConfigBlock = `\t"UserConfig"
\t{
\t\t"exe"\t\t"${userConfigExe.replace(/\\/g, "\\\\")}"
\t}`;
  }

  const vdf = `"AppState"
{
\t"appid"\t\t"${appId}"
\t"name"\t\t"${name}"
\t"installdir"\t\t"${installDir}"
${userConfigBlock}
}
`;
  fs.writeFileSync(path.join(steamappsDir, `appmanifest_${appId}.acf`), vdf, "utf8");

  const gameDir = path.join(steamappsDir, "common", installDir);
  fs.mkdirSync(gameDir, { recursive: true });
  return gameDir;
}

test("findSteamRootSync returns null on non-win32", async () => {
  resetRegistry();
  if (process.platform === "win32") return;
  const { findSteamRootSync } = await importSteamScanner();
  assert.equal(findSteamRootSync(), null);
});

test(
  "findSteamRootSync reads InstallPath from registry on win32",
  { concurrency: false },
  withWin32(async () => {
    resetRegistry();
    const steamRoot = path.join(tmpRoot, "steam-reg");
    fs.mkdirSync(steamRoot, { recursive: true });
    registrySteamPath = steamRoot;

    const { findSteamRootSync } = await importSteamScanner();
    assert.equal(findSteamRootSync(), steamRoot);
  }),
);

test("scanSteam returns platform error on non-win32", async () => {
  if (process.platform === "win32") return;
  const { scanSteam } = await importSteamScanner();
  const result = await scanSteam();
  assert.deepEqual(result, {
    games: [],
    steamRoot: null,
    error: "Steam scan is only supported on Windows.",
  });
});

test(
  "scanSteam returns error when Steam installation is missing",
  { concurrency: false },
  withWin32(async () => {
    resetRegistry();
    const { scanSteam } = await importSteamScanner();
    const result = await scanSteam();
    assert.equal(result.games.length, 0);
    assert.equal(result.steamRoot, null);
    assert.match(result.error ?? "", /not found/i);
  }),
);

test(
  "scanSteam discovers games and picks best exe heuristically",
  { concurrency: false },
  withWin32(async () => {
    resetRegistry();
    const steamRoot = path.join(tmpRoot, "steam-heuristic");
    registrySteamPath = steamRoot;
    writeLibraryFoldersVdf(steamRoot);

    const gameDir = writeAppManifest(steamRoot, {
      appId: "12345",
      name: "Test Game",
      installDir: "TestGame",
    });
    const mainExe = path.join(gameDir, "TestGame.exe");
    fs.writeFileSync(mainExe, "main", "utf8");
    fs.writeFileSync(path.join(gameDir, "redist.exe"), "skip", "utf8");

    const { scanSteam } = await importSteamScanner();
    const result = await scanSteam();
    assert.equal(result.steamRoot, steamRoot);
    assert.equal(result.games.length, 1);
    assert.equal(result.games[0].appId, "12345");
    assert.equal(result.games[0].name, "Test Game");
    assert.equal(result.games[0].bestExePath, mainExe);
  }),
);

test(
  "scanSteam prefers exe declared in manifest UserConfig",
  { concurrency: false },
  withWin32(async () => {
    resetRegistry();
    const steamRoot = path.join(tmpRoot, "steam-manifest-exe");
    registrySteamPath = steamRoot;
    writeLibraryFoldersVdf(steamRoot);

    const gameDir = writeAppManifest(steamRoot, {
      appId: "999",
      name: "Configured Game",
      installDir: "ConfiguredGame",
      userConfigExe: "bin/configured.exe",
    });
    fs.mkdirSync(path.join(gameDir, "bin"), { recursive: true });
    const configuredExe = path.join(gameDir, "bin", "configured.exe");
    fs.writeFileSync(configuredExe, "configured", "utf8");
    fs.writeFileSync(path.join(gameDir, "ConfiguredGame.exe"), "fallback", "utf8");

    const { scanSteam } = await importSteamScanner();
    const result = await scanSteam();
    assert.equal(result.games.length, 1);
    assert.equal(result.games[0].bestExePath, configuredExe);
  }),
);

test(
  "scanSteam deduplicates games by appId across library folders",
  { concurrency: false },
  withWin32(async () => {
    resetRegistry();
    const steamRoot = path.join(tmpRoot, "steam-dedupe");
    const extraLib = path.join(tmpRoot, "steam-dedupe-extra");
    registrySteamPath = steamRoot;
    writeLibraryFoldersVdf(steamRoot, [extraLib]);

    for (const root of [steamRoot, extraLib]) {
      const gameDir = writeAppManifest(root, {
        appId: "42",
        name: "Duplicate Game",
        installDir: "DupGame",
      });
      fs.writeFileSync(path.join(gameDir, "DuplicateGame.exe"), "x", "utf8");
    }

    const { scanSteam } = await importSteamScanner();
    const result = await scanSteam();
    assert.equal(result.games.length, 1);
    assert.equal(result.games[0].appId, "42");
  }),
);

test(
  "resolveSteamGameFromAppPath matches install dir and exe path",
  { concurrency: false },
  withWin32(async () => {
    resetRegistry();
    const steamRoot = path.join(tmpRoot, "steam-resolve");
    registrySteamPath = steamRoot;
    writeLibraryFoldersVdf(steamRoot);

    const gameDir = writeAppManifest(steamRoot, {
      appId: "777",
      name: "Resolve Me",
      installDir: "ResolveMe",
    });
    const exePath = path.join(gameDir, "ResolveMe.exe");
    fs.writeFileSync(exePath, "run", "utf8");

    const { resolveSteamGameFromAppPath } = await importSteamScanner();

    const byInstall = await resolveSteamGameFromAppPath(gameDir);
    assert.equal(byInstall.appId, "777");
    assert.equal(byInstall.steamRoot, steamRoot);
    assert.equal(byInstall.installDir, gameDir);

    const byExe = await resolveSteamGameFromAppPath(exePath);
    assert.equal(byExe.appId, "777");
    assert.equal(byExe.installDir, gameDir);

    const nested = await resolveSteamGameFromAppPath(path.join(gameDir, "saves", "slot1"));
    assert.equal(nested.appId, "777");

    const unknown = await resolveSteamGameFromAppPath(path.join(tmpRoot, "no-such-game"));
    assert.equal(unknown.appId, null);
  }),
);

test(
  "loadScanState returns defaults when file is missing",
  { concurrency: false },
  async () => {
    const statePath = path.join(tmpRoot, "steam-scan-state.json");
    if (fs.existsSync(statePath)) fs.unlinkSync(statePath);

    const { loadScanState } = await importSteamScanner();
    const state = await loadScanState();
    assert.deepEqual(state, {
      addedAppIds: [],
      seenAppIds: [],
      lastScanAt: null,
    });
  },
);

test(
  "saveScanState persists and loadScanState restores roundtrip",
  { concurrency: false },
  async () => {
    const { loadScanState, saveScanState } = await importSteamScanner();
    const payload = {
      addedAppIds: ["1", "2"],
      seenAppIds: ["1", "2", "3"],
      lastScanAt: "2026-08-04T12:00:00.000Z",
    };
    await saveScanState(payload);
    const loaded = await loadScanState();
    assert.deepEqual(loaded, payload);
  },
);
