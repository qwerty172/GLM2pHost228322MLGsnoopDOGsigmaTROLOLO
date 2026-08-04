import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "host-agent-steam-scanner-"));

/** @type {{ regValues: Map<string, string>, execFail: boolean }} */
let childProcessMock = {
  regValues: new Map(),
  execFail: false,
};

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return { app: { getPath: () => tmpRoot } };
  }
  if (request === "node:child_process") {
    return {
      execSync: (cmd) => {
        if (childProcessMock.execFail) throw new Error("reg query failed");
        const match = cmd.match(/reg query "([^"]+)" \/v "([^"]+)"/);
        if (!match) throw new Error(`unexpected reg query: ${cmd}`);
        const [, key, value] = match;
        const lookupKey = `${key}\\${value}`;
        const regValue = childProcessMock.regValues.get(lookupKey);
        if (!regValue) throw new Error(`reg not found: ${lookupKey}`);
        return `    ${value}    REG_SZ    ${regValue}\n`;
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
  childProcessMock = { regValues: new Map(), execFail: false };
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

function setRegistrySteamPath(steamRoot) {
  childProcessMock.regValues.set(
    "HKLM\\SOFTWARE\\Valve\\Steam\\InstallPath",
    steamRoot,
  );
}

function writeLibraryFoldersVdf(steamRoot, extraPaths = []) {
  const lines = [
    '"libraryfolders"',
    "{",
    '\t"0"',
    "\t{",
    `\t\t"path"\t\t"${steamRoot.replace(/\\/g, "\\\\")}"`,
    "\t}",
  ];
  for (let i = 0; i < extraPaths.length; i++) {
    const p = extraPaths[i];
    lines.push(`\t"${i + 1}"`, "\t{", `\t\t"path"\t\t"${p.replace(/\\/g, "\\\\")}"`, "\t}");
  }
  lines.push("}");
  const dir = path.join(steamRoot, "steamapps");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "libraryfolders.vdf"), lines.join("\n"), "utf8");
}

function writeAppManifest(steamRoot, { appId, name, installDir, userConfigExe }) {
  const lines = [
    '"AppState"',
    "{",
    `\t"appid"\t\t"${appId}"`,
    `\t"name"\t\t"${name}"`,
    `\t"installdir"\t\t"${installDir}"`,
  ];
  if (userConfigExe) {
    lines.push('\t"UserConfig"', "\t{", `\t\t"exe"\t\t"${userConfigExe}"`, "\t}");
  }
  lines.push("}");
  const dir = path.join(steamRoot, "steamapps");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `appmanifest_${appId}.acf`), lines.join("\n"), "utf8");
}

function writeGameExe(steamRoot, installDir, exeName, content = "exe") {
  const gameDir = path.join(steamRoot, "steamapps", "common", installDir);
  fs.mkdirSync(gameDir, { recursive: true });
  const exePath = path.join(gameDir, exeName);
  fs.writeFileSync(exePath, content.repeat(1024), "utf8");
  return exePath;
}

test("non-win32: findSteamRootSync returns null", { concurrency: false }, async () => {
  if (process.platform === "win32") return;
  resetMocks();
  const { findSteamRootSync } = await importSteamScanner();
  assert.equal(findSteamRootSync(), null);
});

test("non-win32: scanSteam returns unsupported error", { concurrency: false }, async () => {
  if (process.platform === "win32") return;
  resetMocks();
  const { scanSteam } = await importSteamScanner();
  const result = await scanSteam();
  assert.deepEqual(result.games, []);
  assert.equal(result.steamRoot, null);
  assert.match(result.error ?? "", /only supported on Windows/i);
});

test("non-win32: resolveSteamGameFromAppPath returns nulls", { concurrency: false }, async () => {
  if (process.platform === "win32") return;
  resetMocks();
  const { resolveSteamGameFromAppPath } = await importSteamScanner();
  const result = await resolveSteamGameFromAppPath("C:\\Games\\foo.exe");
  assert.deepEqual(result, { appId: null, installDir: null, steamRoot: null });
});

test(
  "win32: findSteamRootSync reads InstallPath from registry",
  { concurrency: false },
  withWin32(async () => {
    resetMocks();
    const steamRoot = path.join(tmpRoot, "steam-reg");
    fs.mkdirSync(steamRoot, { recursive: true });
    setRegistrySteamPath(steamRoot);
    const { findSteamRootSync } = await importSteamScanner();
    assert.equal(findSteamRootSync(), steamRoot);
  }),
);

test(
  "win32: scanSteam returns not-found error when Steam is missing",
  { concurrency: false },
  withWin32(async () => {
    resetMocks();
    childProcessMock.execFail = true;
    const { scanSteam } = await importSteamScanner();
    const result = await scanSteam();
    assert.deepEqual(result.games, []);
    assert.equal(result.steamRoot, null);
    assert.match(result.error ?? "", /not found/i);
  }),
);

test(
  "win32: scanSteam discovers games from ACF manifests",
  { concurrency: false },
  withWin32(async () => {
    resetMocks();
    const steamRoot = path.join(tmpRoot, "steam-scan");
    fs.mkdirSync(steamRoot, { recursive: true });
    setRegistrySteamPath(steamRoot);
    writeLibraryFoldersVdf(steamRoot);
    writeAppManifest(steamRoot, {
      appId: "570",
      name: "Dota 2",
      installDir: "dota 2 beta",
    });
    writeGameExe(steamRoot, "dota 2 beta", "dota2.exe");

    const { scanSteam } = await importSteamScanner();
    const result = await scanSteam();
    assert.equal(result.steamRoot, steamRoot);
    assert.equal(result.error, undefined);
    assert.equal(result.games.length, 1);
    assert.equal(result.games[0].appId, "570");
    assert.equal(result.games[0].name, "Dota 2");
    assert.ok(result.games[0].bestExePath?.endsWith("dota2.exe"));
  }),
);

test(
  "win32: scanSteam prefers exe from manifest UserConfig",
  { concurrency: false },
  withWin32(async () => {
    resetMocks();
    const steamRoot = path.join(tmpRoot, "steam-manifest-exe");
    fs.mkdirSync(steamRoot, { recursive: true });
    setRegistrySteamPath(steamRoot);
    writeLibraryFoldersVdf(steamRoot);
    writeAppManifest(steamRoot, {
      appId: "440",
      name: "Team Fortress 2",
      installDir: "Team Fortress 2",
      userConfigExe: "bin/hl2.exe",
    });
    writeGameExe(steamRoot, "Team Fortress 2", "tf2.exe");
    writeGameExe(steamRoot, "Team Fortress 2/bin", "hl2.exe");

    const { scanSteam } = await importSteamScanner();
    const result = await scanSteam();
    assert.equal(result.games.length, 1);
    assert.ok(result.games[0].bestExePath?.includes("hl2.exe"));
  }),
);

test(
  "win32: scanSteam deduplicates games by appId across library folders",
  { concurrency: false },
  withWin32(async () => {
    resetMocks();
    const steamRoot = path.join(tmpRoot, "steam-dedup");
    const extraLib = path.join(tmpRoot, "steam-extra-lib");
    fs.mkdirSync(steamRoot, { recursive: true });
    fs.mkdirSync(extraLib, { recursive: true });
    setRegistrySteamPath(steamRoot);
    writeLibraryFoldersVdf(steamRoot, [extraLib]);
    for (const root of [steamRoot, extraLib]) {
      writeAppManifest(root, {
        appId: "730",
        name: "Counter-Strike 2",
        installDir: "Counter-Strike Global Offensive",
      });
      writeGameExe(root, "Counter-Strike Global Offensive", "cs2.exe");
    }

    const { scanSteam } = await importSteamScanner();
    const result = await scanSteam();
    assert.equal(result.games.length, 1);
    assert.equal(result.games[0].appId, "730");
  }),
);

test(
  "win32: resolveSteamGameFromAppPath matches install dir and exe",
  { concurrency: false },
  withWin32(async () => {
    resetMocks();
    const steamRoot = path.join(tmpRoot, "steam-resolve");
    fs.mkdirSync(steamRoot, { recursive: true });
    setRegistrySteamPath(steamRoot);
    writeLibraryFoldersVdf(steamRoot);
    writeAppManifest(steamRoot, {
      appId: "292030",
      name: "The Witcher 3",
      installDir: "The Witcher 3",
    });
    const exePath = writeGameExe(steamRoot, "The Witcher 3", "witcher3.exe");

    const { resolveSteamGameFromAppPath } = await importSteamScanner();
    const byExe = await resolveSteamGameFromAppPath(exePath);
    assert.equal(byExe.appId, "292030");
    assert.equal(byExe.steamRoot, steamRoot);
    assert.ok(byExe.installDir?.includes("The Witcher 3"));

    const installDir = path.join(steamRoot, "steamapps", "common", "The Witcher 3");
    const byDir = await resolveSteamGameFromAppPath(installDir);
    assert.equal(byDir.appId, "292030");
  }),
);

test("loadScanState returns defaults when file is missing", { concurrency: false }, async () => {
  resetMocks();
  const statePath = path.join(tmpRoot, "steam-scan-state.json");
  if (fs.existsSync(statePath)) fs.unlinkSync(statePath);
  const { loadScanState } = await importSteamScanner();
  const state = await loadScanState();
  assert.deepEqual(state, { addedAppIds: [], seenAppIds: [], lastScanAt: null });
});

test("saveScanState and loadScanState roundtrip", { concurrency: false }, async () => {
  resetMocks();
  const { saveScanState, loadScanState } = await importSteamScanner();
  const payload = {
    addedAppIds: ["570", "730"],
    seenAppIds: ["570", "730", "440"],
    lastScanAt: "2026-08-04T12:00:00.000Z",
  };
  await saveScanState(payload);
  const loaded = await loadScanState();
  assert.deepEqual(loaded, payload);
});
