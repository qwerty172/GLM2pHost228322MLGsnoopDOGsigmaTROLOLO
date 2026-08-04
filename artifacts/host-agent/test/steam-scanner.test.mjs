import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "host-agent-steam-scanner-"));
const userDataDir = path.join(tmpRoot, "userData");

/** @type {string | null} */
let registryInstallPath = null;

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return { app: { getPath: (name) => (name === "userData" ? userDataDir : tmpRoot) } };
  }
  if (request === "node:child_process") {
    const real = load.apply(this, arguments);
    return {
      ...real,
      execSync: (cmd, opts) => {
        if (typeof cmd === "string" && cmd.startsWith("reg query")) {
          if (registryInstallPath) {
            const valMatch = cmd.match(/\/v "([^"]+)"/);
            const val = valMatch ? valMatch[1] : "InstallPath";
            return `\r\n    ${val}    REG_SZ    ${registryInstallPath}\r\n`;
          }
          throw new Error("The system was unable to find the specified registry key");
        }
        return real.execSync(cmd, opts);
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

function resetMocks() {
  registryInstallPath = null;
  const statePath = path.join(userDataDir, "steam-scan-state.json");
  try {
    fs.rmSync(statePath, { force: true });
  } catch {
    /* ignore */
  }
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

function writeLibraryFolders(steamRoot) {
  const steamapps = path.join(steamRoot, "steamapps");
  fs.mkdirSync(steamapps, { recursive: true });
  const escaped = steamRoot.replace(/\\/g, "\\\\");
  const vdf = `"libraryfolders"
{
\t"0"
\t{
\t\t"path"\t\t"${escaped}"
\t}
}
`;
  fs.writeFileSync(path.join(steamapps, "libraryfolders.vdf"), vdf, "utf8");
}

function writeSteamGame(steamRoot, { appId, name, installDir, exeName, manifestExe }) {
  const steamapps = path.join(steamRoot, "steamapps");
  fs.mkdirSync(steamapps, { recursive: true });

  let manifest = `"AppState"
{
\t"appid"\t\t"${appId}"
\t"name"\t\t"${name}"
\t"installdir"\t\t"${installDir}"
`;
  if (manifestExe) {
    manifest += `\t"UserConfig"
\t{
\t\t"0"
\t\t{
\t\t\t"exe"\t\t"${manifestExe}"
\t\t\t"type"\t\t"default"
\t\t}
\t}
`;
  }
  manifest += `}\n`;

  fs.writeFileSync(path.join(steamapps, `appmanifest_${appId}.acf`), manifest, "utf8");

  const gameDir = path.join(steamapps, "common", installDir);
  fs.mkdirSync(gameDir, { recursive: true });
  if (exeName) {
    fs.writeFileSync(path.join(gameDir, exeName), Buffer.alloc(4096));
  }
}

test("findSteamRootSync returns null on non-win32", { concurrency: false }, async () => {
  if (process.platform === "win32") return;
  resetMocks();
  const { findSteamRootSync } = await importSteamScanner();
  assert.equal(findSteamRootSync(), null);
});

test("scanSteam returns platform error on non-win32", { concurrency: false }, async () => {
  if (process.platform === "win32") return;
  resetMocks();
  const { scanSteam } = await importSteamScanner();
  const result = await scanSteam();
  assert.deepEqual(result.games, []);
  assert.equal(result.steamRoot, null);
  assert.match(result.error ?? "", /Windows/i);
});

test("resolveSteamGameFromAppPath returns nulls on non-win32", { concurrency: false }, async () => {
  if (process.platform === "win32") return;
  resetMocks();
  const { resolveSteamGameFromAppPath } = await importSteamScanner();
  const result = await resolveSteamGameFromAppPath("C:\\Games\\foo.exe");
  assert.deepEqual(result, { appId: null, installDir: null, steamRoot: null });
});

test("loadScanState returns defaults when file is missing", { concurrency: false }, async () => {
  resetMocks();
  const { loadScanState } = await importSteamScanner();
  const state = await loadScanState();
  assert.deepEqual(state, { addedAppIds: [], seenAppIds: [], lastScanAt: null });
});

test("saveScanState and loadScanState round-trip", { concurrency: false }, async () => {
  resetMocks();
  const { saveScanState, loadScanState } = await importSteamScanner();
  const payload = {
    addedAppIds: ["440", "570"],
    seenAppIds: ["440", "570", "730"],
    lastScanAt: "2026-08-04T12:00:00.000Z",
  };
  await saveScanState(payload);
  const loaded = await loadScanState();
  assert.deepEqual(loaded, payload);
});

test(
  "win32: findSteamRootSync reads InstallPath from registry",
  { concurrency: false },
  withWin32(async () => {
    resetMocks();
    const steamRoot = path.join(tmpRoot, "steam-registry");
    fs.mkdirSync(steamRoot, { recursive: true });
    registryInstallPath = steamRoot;

    const { findSteamRootSync } = await importSteamScanner();
    assert.equal(findSteamRootSync(), steamRoot);
  }),
);

test(
  "win32: scanSteam discovers games from ACF manifests",
  { concurrency: false },
  withWin32(async () => {
    resetMocks();
    const steamRoot = path.join(tmpRoot, "steam-scan");
    registryInstallPath = steamRoot;
    writeLibraryFolders(steamRoot);
    writeSteamGame(steamRoot, {
      appId: "440",
      name: "Team Fortress 2",
      installDir: "Team Fortress 2",
      exeName: "hl2.exe",
    });

    const { scanSteam } = await importSteamScanner();
    const result = await scanSteam();

    assert.equal(result.steamRoot, steamRoot);
    assert.equal(result.error, undefined);
    assert.equal(result.games.length, 1);
    assert.equal(result.games[0].appId, "440");
    assert.equal(result.games[0].name, "Team Fortress 2");
    assert.ok(result.games[0].bestExePath?.endsWith("hl2.exe"));
  }),
);

test(
  "win32: scanSteam prefers exe declared in manifest UserConfig",
  { concurrency: false },
  withWin32(async () => {
    resetMocks();
    const steamRoot = path.join(tmpRoot, "steam-manifest-exe");
    registryInstallPath = steamRoot;
    writeLibraryFolders(steamRoot);
    writeSteamGame(steamRoot, {
      appId: "570",
      name: "Dota 2",
      installDir: "dota 2 beta",
      exeName: "wrong.exe",
      manifestExe: "game/bin/win64/dota2.exe",
    });
    const gameDir = path.join(steamRoot, "steamapps", "common", "dota 2 beta", "game", "bin", "win64");
    fs.mkdirSync(gameDir, { recursive: true });
    fs.writeFileSync(path.join(gameDir, "dota2.exe"), Buffer.alloc(8192));

    const { scanSteam } = await importSteamScanner();
    const result = await scanSteam();

    assert.equal(result.games.length, 1);
    assert.ok(result.games[0].bestExePath?.includes("dota2.exe"));
    assert.ok(!result.games[0].bestExePath?.includes("wrong.exe"));
  }),
);

test(
  "win32: scanSteam deduplicates games by appId",
  { concurrency: false },
  withWin32(async () => {
    resetMocks();
    const steamRoot = path.join(tmpRoot, "steam-dedup");
    registryInstallPath = steamRoot;
    writeLibraryFolders(steamRoot);
    writeSteamGame(steamRoot, {
      appId: "730",
      name: "Counter-Strike 2",
      installDir: "Counter-Strike Global Offensive",
      exeName: "cs2.exe",
    });
    // Duplicate manifest in same folder (malformed duplicate scenario).
    const dupManifest = fs.readFileSync(
      path.join(steamRoot, "steamapps", "appmanifest_730.acf"),
      "utf8",
    );
    fs.writeFileSync(path.join(steamRoot, "steamapps", "appmanifest_730_copy.acf"), dupManifest, "utf8");

    const { scanSteam } = await importSteamScanner();
    const result = await scanSteam();
    const csGames = result.games.filter((g) => g.appId === "730");
    assert.equal(csGames.length, 1);
  }),
);

test(
  "win32: resolveSteamGameFromAppPath matches install dir and exe",
  { concurrency: false },
  withWin32(async () => {
    resetMocks();
    const steamRoot = path.join(tmpRoot, "steam-resolve");
    registryInstallPath = steamRoot;
    writeLibraryFolders(steamRoot);
    writeSteamGame(steamRoot, {
      appId: "292030",
      name: "The Witcher 3",
      installDir: "The Witcher 3",
      exeName: "witcher3.exe",
    });

    const installDir = path.join(steamRoot, "steamapps", "common", "The Witcher 3");
    const exePath = path.join(installDir, "witcher3.exe");

    const { resolveSteamGameFromAppPath } = await importSteamScanner();
    const byDir = await resolveSteamGameFromAppPath(installDir);
    assert.equal(byDir.appId, "292030");
    assert.equal(byDir.steamRoot, steamRoot);
    assert.equal(path.normalize(byDir.installDir ?? ""), path.normalize(installDir));

    const byExe = await resolveSteamGameFromAppPath(exePath);
    assert.equal(byExe.appId, "292030");
  }),
);

test(
  "win32: scanSteam returns error when Steam is not installed",
  { concurrency: false },
  withWin32(async () => {
    resetMocks();
    registryInstallPath = null;

    const { scanSteam } = await importSteamScanner();
    const result = await scanSteam();

    assert.deepEqual(result.games, []);
    assert.equal(result.steamRoot, null);
    assert.match(result.error ?? "", /not found/i);
  }),
);
