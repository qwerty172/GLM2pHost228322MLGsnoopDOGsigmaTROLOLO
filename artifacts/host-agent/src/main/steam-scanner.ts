// Steam library scanner — Windows-only.
// Reads the Steam registry key → finds all library folders → parses ACF
// manifests → returns discovered games with a best-guess exe path.
//
// All filesystem access is guarded against errors so the scanner never
// crashes the main process on unexpected directory layouts.

import { execSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { app } from "electron";
import { log } from "./logger";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SteamLibraryGame {
  appId: string;
  name: string;
  installDir: string;
  fullInstallPath: string;
  bestExePath: string | null;
}

export interface SteamScanState {
  // AppIds successfully added to the host's library.
  addedAppIds: string[];
  // All appIds ever discovered during any previous scan.
  // Used to compute the delta on repeat scans (new = not yet in seenAppIds).
  seenAppIds: string[];
  lastScanAt: string | null;
}

// ─── Steam root detection ─────────────────────────────────────────────────────

function queryRegistry(key: string, value: string): string | null {
  try {
    const out = execSync(`reg query "${key}" /v "${value}"`, {
      encoding: "utf-8",
      timeout: 3000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const match = out.match(new RegExp(`${value}\\s+REG_SZ\\s+(.+)`, "i"));
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

export function findSteamRootSync(): string | null {
  if (process.platform !== "win32") return null;

  // Try 64-bit and 32-bit registry hives.
  const regPaths = [
    ["HKLM\\SOFTWARE\\Valve\\Steam", "InstallPath"],
    ["HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam", "InstallPath"],
    ["HKCU\\SOFTWARE\\Valve\\Steam", "SteamPath"],
  ];
  for (const [key, val] of regPaths) {
    const result = queryRegistry(key, val);
    if (result) return result;
  }

  // Fallback to known default locations.
  const defaults = [
    "C:\\Program Files (x86)\\Steam",
    "C:\\Program Files\\Steam",
  ];
  for (const dir of defaults) {
    try {
      require("fs").statSync(dir);
      return dir;
    } catch { /* continue */ }
  }
  return null;
}

// ─── Minimal VDF parser ───────────────────────────────────────────────────────
// Handles the subset of Valve Data Format used by libraryfolders.vdf and
// appmanifest_*.acf files. Only parses the first-level key→string values and
// nested blocks — sufficient for our needs without a full grammar.

function parseVdf(text: string): Record<string, unknown> {
  const lines = text.split(/\r?\n/);
  let i = 0;

  function skipToBlock(): void {
    while (i < lines.length && lines[i].trim() !== "{") i++;
    i++; // consume "{"
  }

  function parseBlock(): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    while (i < lines.length) {
      const line = lines[i].trim();
      i++;
      if (line === "" || line.startsWith("//")) continue;
      if (line === "}") break;

      // "key" "value"  or  "key"\n{
      const kv = line.match(/^"([^"]*)"(?:\s+"([^"]*)")?$/);
      if (!kv) continue;
      const [, key, val] = kv;
      if (val !== undefined) {
        obj[key] = val;
      } else {
        // Nested block — skip blank/comment lines then expect "{"
        while (i < lines.length && lines[i].trim() === "") i++;
        if (i < lines.length && lines[i].trim() === "{") {
          i++; // consume "{"
          obj[key] = parseBlock();
        }
      }
    }
    return obj;
  }

  // Skip to the root block.
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.startsWith('"')) {
      i++; // key line
      skipToBlock();
      return parseBlock();
    }
    i++;
  }
  return {};
}

// ─── Library folder enumeration ───────────────────────────────────────────────

async function findLibraryFolders(steamRoot: string): Promise<string[]> {
  const vdfPath = path.join(steamRoot, "steamapps", "libraryfolders.vdf");
  const folders: string[] = [steamRoot];
  try {
    const text = await fs.readFile(vdfPath, "utf-8");
    const parsed = parseVdf(text);
    for (const val of Object.values(parsed)) {
      if (typeof val === "object" && val !== null) {
        const p = (val as Record<string, unknown>)["path"];
        if (typeof p === "string" && p.trim()) folders.push(p.trim());
      }
    }
  } catch (err) {
    log("warn", `[steam-scanner] Could not read libraryfolders.vdf: ${String(err)}`);
  }
  return folders;
}

// ─── ACF manifest parsing ─────────────────────────────────────────────────────

// Try to extract a preferred exe path from ACF UserConfig / MountedConfig blocks.
// Steam sometimes writes the resolved launch executable or user overrides here.
// Prefer this over heuristic search when the path resolves to an actual file.
function exeFromAcfConfig(
  parsed: Record<string, unknown>,
  installBase: string,
): string | null {
  for (const blockKey of ["UserConfig", "MountedConfig"]) {
    const block = parsed[blockKey];
    if (typeof block !== "object" || block === null) continue;
    const obj = block as Record<string, unknown>;

    // Direct "exe" key in the config block.
    const directExe = obj["exe"];
    if (typeof directExe === "string" && directExe.trim()) {
      return path.join(installBase, directExe.trim().replace(/\//g, path.sep));
    }

    // Numbered launch entries (e.g. "0" { "exe" "bin\\game.exe" "type" "default" }).
    for (const entryVal of Object.values(obj)) {
      if (typeof entryVal !== "object" || entryVal === null) continue;
      const entry = entryVal as Record<string, unknown>;
      const entryExe = entry["exe"];
      const entryType = String(entry["type"] ?? "");
      if (typeof entryExe === "string" && entryExe.trim()) {
        // Accept "default", "none", or no type — skip server/dedicated entries.
        if (!entryType || entryType === "default" || entryType === "none") {
          return path.join(installBase, entryExe.trim().replace(/\//g, path.sep));
        }
      }
    }
  }
  return null;
}

async function scanLibraryFolder(libraryPath: string): Promise<SteamLibraryGame[]> {
  const steamappsDir = path.join(libraryPath, "steamapps");
  const games: SteamLibraryGame[] = [];

  let files: string[];
  try {
    files = await fs.readdir(steamappsDir);
  } catch {
    return [];
  }

  for (const file of files) {
    if (!file.startsWith("appmanifest_") || !file.endsWith(".acf")) continue;
    try {
      const text = await fs.readFile(path.join(steamappsDir, file), "utf-8");
      const parsed = parseVdf(text);
      const appId = String(parsed["appid"] ?? "").trim();
      const name = String(parsed["name"] ?? "").trim();
      const installDir = String(parsed["installdir"] ?? "").trim();
      if (!appId || !name || !installDir) continue;

      const fullInstallPath = path.join(steamappsDir, "common", installDir);

      // Prefer an exe declared in the manifest over the heuristic search.
      let bestExePath: string | null = null;
      const manifestExe = exeFromAcfConfig(parsed, fullInstallPath);
      if (manifestExe) {
        try {
          await fs.access(manifestExe);
          bestExePath = manifestExe;
          log("info", `[steam-scanner] Manifest exe for ${name}: ${manifestExe}`);
        } catch {
          // Declared path doesn't exist on disk — fall through to heuristic.
        }
      }
      if (!bestExePath) {
        bestExePath = await findBestExe(fullInstallPath, name);
      }

      games.push({ appId, name, installDir, fullInstallPath, bestExePath });
    } catch { /* skip bad manifest */ }
  }
  return games;
}

// ─── Best-guess exe resolver ──────────────────────────────────────────────────
// Shallow (max depth 2) recursive search with heuristic ranking:
//   1. Exe name includes the game name (normalised)
//   2. Located at shallower depth
//   3. Largest file size (main exe tends to be the biggest)

const SKIP_EXE_PATTERN =
  /^(unins|redist|dxsetup|vc_|dotnet|setup[^.]*$|_common|crash|report|helper|launcher_|engine|easyanti|battleeye)/i;

async function findBestExe(gameDir: string, gameName: string): Promise<string | null> {
  const candidates: Array<{ exePath: string; size: number; depth: number }> = [];
  const MAX_DEPTH = 2;

  async function scan(dir: string, depth: number): Promise<void> {
    if (depth > MAX_DEPTH) return;
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory() && depth < MAX_DEPTH) {
        await scan(path.join(dir, entry.name), depth + 1);
      } else if (
        entry.isFile() &&
        entry.name.toLowerCase().endsWith(".exe") &&
        !SKIP_EXE_PATTERN.test(entry.name)
      ) {
        const exePath = path.join(dir, entry.name);
        try {
          const { size } = await fs.stat(exePath);
          candidates.push({ exePath, size, depth });
        } catch { /* skip */ }
      }
    }
  }

  await scan(gameDir, 0);
  if (candidates.length === 0) return null;

  const normGame = gameName.toLowerCase().replace(/[^a-z0-9]/g, "");

  candidates.sort((a, b) => {
    const an = path.basename(a.exePath, ".exe").toLowerCase().replace(/[^a-z0-9]/g, "");
    const bn = path.basename(b.exePath, ".exe").toLowerCase().replace(/[^a-z0-9]/g, "");
    const aMatch = an.includes(normGame) || normGame.includes(an);
    const bMatch = bn.includes(normGame) || normGame.includes(bn);
    if (aMatch !== bMatch) return aMatch ? -1 : 1;
    if (a.depth !== b.depth) return a.depth - b.depth;
    return b.size - a.size;
  });

  return candidates[0]?.exePath ?? null;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function scanSteam(): Promise<{
  games: SteamLibraryGame[];
  steamRoot: string | null;
  error?: string;
}> {
  if (process.platform !== "win32") {
    return { games: [], steamRoot: null, error: "Steam scan is only supported on Windows." };
  }

  const steamRoot = findSteamRootSync();
  if (!steamRoot) {
    return {
      games: [],
      steamRoot: null,
      error: "Steam installation not found. Check that Steam is installed.",
    };
  }

  log("info", `[steam-scanner] Steam root: ${steamRoot}`);
  const libraryFolders = await findLibraryFolders(steamRoot);
  log("info", `[steam-scanner] Library folders: ${libraryFolders.join(", ")}`);

  const allGames: SteamLibraryGame[] = [];
  for (const folder of libraryFolders) {
    const games = await scanLibraryFolder(folder);
    allGames.push(...games);
    log("info", `[steam-scanner] ${games.length} game(s) in ${folder}`);
  }

  // Deduplicate by appId (same game can appear in multiple library paths).
  const seen = new Set<string>();
  const unique = allGames.filter((g) => {
    if (seen.has(g.appId)) return false;
    seen.add(g.appId);
    return true;
  });

  unique.sort((a, b) => a.name.localeCompare(b.name));
  log("info", `[steam-scanner] Total unique games: ${unique.length}`);
  return { games: unique, steamRoot };
}

// ─── App path → Steam metadata ────────────────────────────────────────────────

export async function resolveSteamGameFromAppPath(appPath: string): Promise<{
  appId: string | null;
  installDir: string | null;
  steamRoot: string | null;
}> {
  if (process.platform !== "win32") {
    return { appId: null, installDir: null, steamRoot: null };
  }

  const steamRoot = findSteamRootSync();
  if (!steamRoot) {
    return { appId: null, installDir: null, steamRoot: null };
  }

  const normalizedApp = path.normalize(appPath).toLowerCase();
  const libraryFolders = await findLibraryFolders(steamRoot);
  for (const folder of libraryFolders) {
    const games = await scanLibraryFolder(folder);
    for (const game of games) {
      const normalizedInstall = path.normalize(game.fullInstallPath).toLowerCase();
      const normalizedExe = game.bestExePath
        ? path.normalize(game.bestExePath).toLowerCase()
        : null;
      if (
        normalizedApp === normalizedInstall ||
        normalizedApp.startsWith(`${normalizedInstall}${path.sep}`) ||
        (normalizedExe && normalizedApp === normalizedExe)
      ) {
        return {
          appId: game.appId,
          installDir: game.fullInstallPath,
          steamRoot,
        };
      }
    }
  }

  return { appId: null, installDir: null, steamRoot };
}

// ─── Scan state persistence ───────────────────────────────────────────────────
// Keeps track of which Steam App IDs the host has already added to their
// library so repeated scans only show newly installed games (delta mode).

function scanStatePath(): string {
  return path.join(app.getPath("userData"), "steam-scan-state.json");
}

export async function loadScanState(): Promise<SteamScanState> {
  try {
    const text = await fs.readFile(scanStatePath(), "utf-8");
    const parsed = JSON.parse(text) as Partial<SteamScanState>;
    return {
      addedAppIds: Array.isArray(parsed.addedAppIds) ? parsed.addedAppIds : [],
      seenAppIds: Array.isArray(parsed.seenAppIds) ? parsed.seenAppIds : [],
      lastScanAt: parsed.lastScanAt ?? null,
    };
  } catch {
    return { addedAppIds: [], seenAppIds: [], lastScanAt: null };
  }
}

export async function saveScanState(state: SteamScanState): Promise<void> {
  try {
    const p = scanStatePath();
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, JSON.stringify(state, null, 2), "utf-8");
  } catch (err) {
    log("warn", `[steam-scanner] Failed to save scan state: ${String(err)}`);
  }
}
