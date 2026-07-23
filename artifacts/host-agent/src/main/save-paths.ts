// Discover local save file paths via Steam Cloud userdata and Ludusavi manifest.

import { promises as fs } from "node:fs";
import path from "node:path";
import { app } from "electron";
import { parse as parseYaml } from "yaml";
import { findSteamRootSync, resolveSteamGameFromAppPath } from "./steam-scanner";
import { log } from "./logger";

const LUDUSAVI_MANIFEST_URL =
  "https://raw.githubusercontent.com/mtkennerly/ludusavi-manifest/master/data/manifest.yaml";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const STEAM_ID_OFFSET = 76561197960265728n;

type LudusaviCache = {
  builtAt: string;
  bySteamAppId: Record<string, string[]>;
};

export type DiscoverSavePathsOpts = {
  steamAppId?: string | null;
  appPath: string;
};

export type DiscoverSavePathsResult = {
  paths: string[];
  steamAppId: string | null;
};

function ludusaviCachePath(): string {
  return path.join(app.getPath("userData"), "ludusavi-index.json");
}

function parseVdf(text: string): Record<string, unknown> {
  const lines = text.split(/\r?\n/);
  let i = 0;

  function skipToBlock(): void {
    while (i < lines.length && lines[i].trim() !== "{") i++;
    i++;
  }

  function parseBlock(): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    while (i < lines.length) {
      const line = lines[i].trim();
      i++;
      if (line === "" || line.startsWith("//")) continue;
      if (line === "}") break;

      const kv = line.match(/^"([^"]*)"(?:\s+"([^"]*)")?$/);
      if (!kv) continue;
      const [, key, val] = kv;
      if (val !== undefined) {
        obj[key] = val;
      } else {
        while (i < lines.length && lines[i].trim() === "") i++;
        if (i < lines.length && lines[i].trim() === "{") {
          i++;
          obj[key] = parseBlock();
        }
      }
    }
    return obj;
  }

  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.startsWith('"')) {
      i++;
      skipToBlock();
      return parseBlock();
    }
    i++;
  }
  return {};
}

function steamId64ToAccountId(steamId64: string): string | null {
  try {
    const id = BigInt(steamId64);
    const accountId = id - STEAM_ID_OFFSET;
    if (accountId < 0n) return null;
    return accountId.toString();
  } catch {
    return null;
  }
}

async function getSteamAccountId(steamRoot: string): Promise<string | null> {
  try {
    const text = await fs.readFile(
      path.join(steamRoot, "config", "loginusers.vdf"),
      "utf-8",
    );
    const parsed = parseVdf(text);
    let mostRecentId: string | null = null;
    for (const [steamId64, value] of Object.entries(parsed)) {
      if (typeof value !== "object" || value === null) continue;
      const user = value as Record<string, unknown>;
      if (String(user.MostRecent ?? "") === "1") {
        mostRecentId = steamId64;
        break;
      }
    }
    if (!mostRecentId) {
      const first = Object.keys(parsed)[0];
      mostRecentId = first ?? null;
    }
    return mostRecentId ? steamId64ToAccountId(mostRecentId) : null;
  } catch (err) {
    log("warn", `[save-paths] Could not read loginusers.vdf: ${String(err)}`);
    return null;
  }
}

function matchesWindows(when: unknown): boolean {
  if (!when) return true;
  if (!Array.isArray(when)) return true;
  return when.some((block) => {
    if (typeof block !== "object" || block === null) return false;
    const conditions = block as Record<string, unknown>;
    if (conditions.os && conditions.os !== "windows") return false;
    return true;
  });
}

function buildLudusaviIndex(manifest: Record<string, unknown>): Record<string, string[]> {
  const index: Record<string, string[]> = {};

  for (const gameData of Object.values(manifest)) {
    if (typeof gameData !== "object" || gameData === null) continue;
    const entry = gameData as Record<string, unknown>;
    const steam = entry.steam;
    if (typeof steam !== "object" || steam === null) continue;
    const appId = String((steam as Record<string, unknown>).id ?? "").trim();
    if (!appId) continue;

    const files = entry.files;
    if (typeof files !== "object" || files === null) continue;

    for (const [pathTemplate, meta] of Object.entries(files)) {
      if (typeof meta !== "object" || meta === null) continue;
      const metaObj = meta as Record<string, unknown>;
      const tags = metaObj.tags;
      if (!Array.isArray(tags) || !tags.includes("save")) continue;
      if (!matchesWindows(metaObj.when)) continue;

      if (!index[appId]) index[appId] = [];
      index[appId].push(pathTemplate);
    }
  }

  return index;
}

async function loadLudusaviIndex(): Promise<Record<string, string[]>> {
  const cachePath = ludusaviCachePath();
  try {
    const text = await fs.readFile(cachePath, "utf-8");
    const cached = JSON.parse(text) as LudusaviCache;
    const age = Date.now() - Date.parse(cached.builtAt);
    if (Number.isFinite(age) && age < CACHE_TTL_MS && cached.bySteamAppId) {
      return cached.bySteamAppId;
    }
  } catch {
    // refresh below
  }

  try {
    log("info", "[save-paths] Downloading Ludusavi manifest…");
    const resp = await fetch(LUDUSAVI_MANIFEST_URL, {
      signal: AbortSignal.timeout(120_000),
    });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    const yamlText = await resp.text();
    const manifest = parseYaml(yamlText) as Record<string, unknown>;
    const bySteamAppId = buildLudusaviIndex(manifest);
    const cache: LudusaviCache = {
      builtAt: new Date().toISOString(),
      bySteamAppId,
    };
    await fs.mkdir(path.dirname(cachePath), { recursive: true });
    await fs.writeFile(cachePath, JSON.stringify(cache), "utf-8");
    log("info", `[save-paths] Ludusavi index built (${Object.keys(bySteamAppId).length} games)`);
    return bySteamAppId;
  } catch (err) {
    log("warn", `[save-paths] Ludusavi manifest refresh failed: ${String(err)}`);
    try {
      const text = await fs.readFile(cachePath, "utf-8");
      const cached = JSON.parse(text) as LudusaviCache;
      return cached.bySteamAppId ?? {};
    } catch {
      return {};
    }
  }
}

type PathContext = {
  home: string;
  appData: string;
  localAppData: string;
  documents: string;
  installDir: string;
  steamUserId: string | null;
};

function resolveTemplate(template: string, ctx: PathContext): string {
  let resolved = template
    .replace(/<home>/g, ctx.home)
    .replace(/<winAppData>/g, ctx.appData)
    .replace(/<winLocalAppData>/g, ctx.localAppData)
    .replace(/<winDocuments>/g, ctx.documents)
    .replace(/<storeUserId>/g, ctx.steamUserId ?? "")
    .replace(/<base>/g, ctx.installDir)
    .replace(/<game>/g, ctx.installDir);

  if (resolved.endsWith("/*")) {
    resolved = resolved.slice(0, -2);
  }
  return path.normalize(resolved.replace(/\//g, path.sep));
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function collectExistingPaths(candidates: string[]): Promise<string[]> {
  const unique = [...new Set(candidates.map((p) => path.normalize(p)))];
  const existing: string[] = [];
  for (const candidate of unique) {
    if (await pathExists(candidate)) {
      existing.push(candidate);
    }
  }
  return existing;
}

export async function discoverSavePaths(
  opts: DiscoverSavePathsOpts,
): Promise<DiscoverSavePathsResult> {
  if (process.platform !== "win32") {
    return { paths: [], steamAppId: opts.steamAppId ?? null };
  }

  const steamMeta = await resolveSteamGameFromAppPath(opts.appPath);
  const steamAppId = opts.steamAppId ?? steamMeta.appId;
  const installDir =
    steamMeta.installDir ??
    (opts.appPath ? path.dirname(opts.appPath) : "");
  const steamRoot = steamMeta.steamRoot ?? findSteamRootSync();

  const home = process.env.USERPROFILE ?? process.env.HOME ?? "";
  const ctx: PathContext = {
    home,
    appData: process.env.APPDATA ?? path.join(home, "AppData", "Roaming"),
    localAppData: process.env.LOCALAPPDATA ?? path.join(home, "AppData", "Local"),
    documents: path.join(home, "Documents"),
    installDir,
    steamUserId: steamRoot ? await getSteamAccountId(steamRoot) : null,
  };

  const candidates: string[] = [];

  if (steamRoot && steamAppId && ctx.steamUserId) {
    const userdataBase = path.join(
      steamRoot,
      "userdata",
      ctx.steamUserId,
      steamAppId,
    );
    candidates.push(
      path.join(userdataBase, "remote"),
      path.join(userdataBase, "local"),
    );
  }

  if (steamAppId) {
    const ludusaviIndex = await loadLudusaviIndex();
    const templates = ludusaviIndex[steamAppId] ?? [];
    for (const template of templates) {
      candidates.push(resolveTemplate(template, ctx));
    }
  }

  const paths = await collectExistingPaths(candidates);
  return { paths, steamAppId };
}

/** Return candidate save paths even when they do not exist yet (for restore/clear). */
export async function resolveSavePathCandidates(
  opts: DiscoverSavePathsOpts,
): Promise<{ paths: string[]; steamAppId: string | null }> {
  const discovered = await discoverSavePaths(opts);
  if (discovered.paths.length > 0) {
    return discovered;
  }

  if (process.platform !== "win32") {
    return { paths: [], steamAppId: opts.steamAppId ?? null };
  }

  const steamMeta = await resolveSteamGameFromAppPath(opts.appPath);
  const steamAppId = opts.steamAppId ?? steamMeta.appId;
  const installDir =
    steamMeta.installDir ??
    (opts.appPath ? path.dirname(opts.appPath) : "");
  const steamRoot = steamMeta.steamRoot ?? findSteamRootSync();

  const home = process.env.USERPROFILE ?? process.env.HOME ?? "";
  const ctx: PathContext = {
    home,
    appData: process.env.APPDATA ?? path.join(home, "AppData", "Roaming"),
    localAppData: process.env.LOCALAPPDATA ?? path.join(home, "AppData", "Local"),
    documents: path.join(home, "Documents"),
    installDir,
    steamUserId: steamRoot ? await getSteamAccountId(steamRoot) : null,
  };

  const candidates: string[] = [];
  if (steamRoot && steamAppId && ctx.steamUserId) {
    const userdataBase = path.join(
      steamRoot,
      "userdata",
      ctx.steamUserId,
      steamAppId,
    );
    candidates.push(
      path.join(userdataBase, "remote"),
      path.join(userdataBase, "local"),
    );
  }

  if (steamAppId) {
    const ludusaviIndex = await loadLudusaviIndex();
    for (const template of ludusaviIndex[steamAppId] ?? []) {
      candidates.push(resolveTemplate(template, ctx));
    }
  }

  return {
    paths: [...new Set(candidates.map((p) => path.normalize(p)))],
    steamAppId,
  };
}
