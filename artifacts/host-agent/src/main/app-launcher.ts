import { spawn, ChildProcess } from "node:child_process";
import path from "node:path";
import { shell, desktopCapturer } from "electron";
import type { HostConfig, GameEntryLaunch } from "../shared/messages";
import { browserWindowStillOpen, hostFromBoundUrl } from "../shared/window-match";
import { clearAllowedTarget, setAllowedTarget } from "./focus-guard";
import { launchWithLimitedUser, type LimitedUserConfig } from "./limited-user-launch";
import { loadConfig } from "./config";
import { log } from "./logger";

let current: ChildProcess | null = null;
let lastSpawnedPid: number | null = null;
/** Launch target for the process/browser session tracked by `current` / `lastWasUrl`. */
let activeLaunchKey: string | null = null;
// Tracks whether the current "launch" was a browser URL (no child process,
// just a shell.openExternal). killApp() can't actually close the browser
// tab, but we use this flag to skip the kill attempt cleanly.
let lastWasUrl = false;
let lastBrowserHost = "";

// Polls for browser window disappearance so billing can stop when the host
// closes the tab/window opened for a browser-game session.
let browserWatchTimer: ReturnType<typeof setInterval> | null = null;
const BROWSER_WATCH_INTERVAL_MS = 10_000;
const BROWSER_WATCH_GRACE_MS = 30_000;
const BROWSER_GONE_STREAK_TO_END = 3;

// Optional one-shot callback invoked when the native process exits.
// Cleared after first call. The main process uses this to push an
// "app:game-exited" event to the renderer so the session auto-ends.
let exitCallback: (() => void) | null = null;

export function getLastSpawnedPid(): number | null {
  return lastSpawnedPid;
}

/** Stable key for deduplicating launches vs forcing relaunch when the target changes. */
export function launchTargetKey(target: {
  boundUrl?: string | null;
  appPath?: string | null;
}): string {
  const url = (target.boundUrl ?? "").trim();
  if (url.length > 0) return `url:${url}`;
  return `exe:${(target.appPath ?? "").trim().toLowerCase()}`;
}

function clearSpawnedPid(): void {
  lastSpawnedPid = null;
}

function clearLaunchTracking(): void {
  activeLaunchKey = null;
  clearSpawnedPid();
}

export function setExitCallback(cb: () => void): void {
  exitCallback = cb;
}

export function clearExitCallback(): void {
  exitCallback = null;
}

type SpawnResult = { child: ChildProcess; gamePid?: number };

async function spawnNativeApp(
  appPath: string,
  args: string[],
  cwd: string,
): Promise<SpawnResult> {
  const limited = await tryLimitedLaunch(appPath, args, cwd);
  if (limited) return limited;

  const child = spawn(appPath, args, {
    cwd,
    detached: false,
    stdio: "ignore",
    windowsHide: false,
  });
  return { child };
}

async function tryLimitedLaunch(
  appPath: string,
  args: string[],
  cwd: string,
): Promise<SpawnResult | null> {
  const cfg = await loadConfig();
  const lu = cfg.limitedUser;
  if (!lu?.enabled) return null;
  const result = launchWithLimitedUser(appPath, args, cwd, lu as LimitedUserConfig);
  if (!result.ok || !result.pid) {
    log("warn", `[limited-user] Fallback to standard spawn: ${result.error}`);
    return null;
  }
  // Limited-user launch has no Node ChildProcess — watch game exit via PowerShell.
  const watcher = spawn(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      `Wait-Process -Id ${result.pid} -ErrorAction SilentlyContinue`,
    ],
    { cwd, stdio: "ignore", windowsHide: true },
  );
  log("info", `[limited-user] Watching game pid=${result.pid}`);
  return { child: watcher, gamePid: result.pid };
}

function fireExit(): void {
  stopBrowserWatch();
  clearLaunchTracking();
  if (exitCallback) {
    const cb = exitCallback;
    exitCallback = null;
    cb();
  }
}

function stopBrowserWatch(): void {
  if (browserWatchTimer) {
    clearInterval(browserWatchTimer);
    browserWatchTimer = null;
  }
}

async function isBrowserWindowStillOpen(hostHint: string): Promise<boolean> {
  try {
    const sources = await desktopCapturer.getSources({
      types: ["window"],
      thumbnailSize: { width: 0, height: 0 },
    });
    return browserWindowStillOpen(sources, hostHint);
  } catch {
    // If we can't enumerate windows, keep the session alive.
    return true;
  }
}

function startBrowserWatch(url: string): void {
  stopBrowserWatch();
  lastBrowserHost = hostFromBoundUrl(url);
  const startedAt = Date.now();
  let goneStreak = 0;
  browserWatchTimer = setInterval(() => {
    void (async () => {
      if (Date.now() - startedAt < BROWSER_WATCH_GRACE_MS) return;
      const open = await isBrowserWindowStillOpen(lastBrowserHost);
      if (open) {
        goneStreak = 0;
        return;
      }
      goneStreak += 1;
      log(
        "info",
        `[browser-watch] No browser window (${goneStreak}/${BROWSER_GONE_STREAK_TO_END})`,
      );
      if (goneStreak >= BROWSER_GONE_STREAK_TO_END) {
        log("info", "[browser-watch] Browser closed — ending session");
        lastWasUrl = false;
        fireExit();
      }
    })();
  }, BROWSER_WATCH_INTERVAL_MS);
}

export function isRunning(): boolean {
  return current !== null && current.exitCode === null;
}

// Library-based launch: takes a GameEntryLaunch (from hostGamesTable).
// Browser games open in the default browser; native games spawn the exe.
export async function launchEntry(
  entry: GameEntryLaunch,
): Promise<{ ok: boolean; pid?: number; error?: string }> {
  const launchKey = launchTargetKey(entry);
  const reuse = (isRunning() || lastWasUrl) && activeLaunchKey === launchKey;
  if (reuse) {
    return { ok: true, pid: lastSpawnedPid ?? current?.pid ?? undefined };
  }
  if (isRunning() || lastWasUrl) {
    killApp();
  }

  const url = (entry.boundUrl ?? "").trim();
  if (url.length > 0) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { ok: false, error: "boundUrl must be http(s)" };
      }
      void shell.openExternal(parsed.toString());
      lastWasUrl = true;
      activeLaunchKey = launchKey;
      clearSpawnedPid();
      setAllowedTarget(null, { guardDisabled: true });
      startBrowserWatch(parsed.toString());
      log("info", `[library] Opened browser URL ${parsed.toString()}`);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: `Invalid boundUrl: ${String(err)}` };
    }
  }

  if (!entry.appPath) {
    return { ok: false, error: "Library entry has no appPath or boundUrl" };
  }
  try {
    stopBrowserWatch();
    const args = parseArgs(entry.launchArgs ?? "");
    const cwd = path.dirname(entry.appPath);
    const { child, gamePid } = await spawnNativeApp(entry.appPath, args, cwd);
    child.on("exit", (code, signal) => {
      log("info", `[library] Game exited code=${code} signal=${signal}`);
      current = null;
      fireExit();
    });
    child.on("error", (err) => {
      log("error", `[library] Game error: ${String(err)}`);
      current = null;
      fireExit();
    });
    current = child;
    lastWasUrl = false;
    const pid = gamePid ?? child.pid;
    lastSpawnedPid = pid ?? null;
    activeLaunchKey = launchKey;
    if (pid) setAllowedTarget(pid);
    log("info", `[library] Launched ${entry.appPath} pid=${pid}`);
    return { ok: true, pid };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// Legacy single-game launch using the host's HostConfig (boundUrl / appPath / appArgs).
// Preserved for backward compat with hosts that have no multi-game library.
export async function launchApp(
  config: HostConfig,
): Promise<{ ok: boolean; pid?: number; error?: string }> {
  const launchKey = launchTargetKey(config);
  const reuse = (isRunning() || lastWasUrl) && activeLaunchKey === launchKey;
  if (reuse) {
    return { ok: true, pid: lastSpawnedPid ?? current?.pid ?? undefined };
  }
  if (isRunning() || lastWasUrl) {
    killApp();
  }

  const url = (config.boundUrl ?? "").trim();
  if (url.length > 0) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { ok: false, error: "boundUrl must be http(s)" };
      }
      void shell.openExternal(parsed.toString());
      lastWasUrl = true;
      activeLaunchKey = launchKey;
      clearSpawnedPid();
      setAllowedTarget(null, { guardDisabled: true });
      startBrowserWatch(parsed.toString());
      log("info", `Opened browser URL ${parsed.toString()}`);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: `Invalid boundUrl: ${String(err)}` };
    }
  }

  if (!config.appPath) {
    return { ok: false, error: "No app path or URL configured" };
  }
  try {
    stopBrowserWatch();
    const args = parseArgs(config.appArgs ?? "");
    const cwd = path.dirname(config.appPath);
    const { child, gamePid } = await spawnNativeApp(config.appPath, args, cwd);
    child.on("exit", (code, signal) => {
      log("info", `Target app exited code=${code} signal=${signal}`);
      current = null;
      fireExit();
    });
    child.on("error", (err) => {
      log("error", `Target app error: ${String(err)}`);
      current = null;
      fireExit();
    });
    current = child;
    lastWasUrl = false;
    const pid = gamePid ?? child.pid;
    lastSpawnedPid = pid ?? null;
    activeLaunchKey = launchKey;
    if (pid) setAllowedTarget(pid);
    log("info", `Launched ${config.appPath} pid=${pid}`);
    return { ok: true, pid };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// Windows-style command-line tokenizer that respects double-quoted spans
// and backslash-escaped quotes. Behaves like a simplified CommandLineToArgvW
// so users can paste args such as: -map "Custom Map.umap" -log
export function parseArgs(input: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (ch === "\\" && input[i + 1] === '"') {
      cur += '"';
      i++;
    } else if (ch === '"') {
      inQuote = !inQuote;
    } else if (!inQuote && (ch === " " || ch === "\t")) {
      if (cur.length > 0) {
        out.push(cur);
        cur = "";
      }
    } else {
      cur += ch;
    }
  }
  if (cur.length > 0) out.push(cur);
  return out;
}

export function killApp(): void {
  clearAllowedTarget();
  clearExitCallback();
  stopBrowserWatch();
  clearLaunchTracking();
  // We can't close a browser tab we opened via shell.openExternal; the user
  // (or their OS) handles it. Just log and bail.
  if (lastWasUrl && !current) {
    log("info", "Skip killApp: browser-URL binding has no child process.");
    lastWasUrl = false;
    return;
  }
  if (!current) return;
  try {
    current.kill();
  } catch (err) {
    log("warn", `Failed to kill app: ${String(err)}`);
  }
  current = null;
  lastWasUrl = false;
}
