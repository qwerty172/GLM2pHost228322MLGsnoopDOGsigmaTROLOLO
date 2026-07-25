import { spawn, ChildProcess } from "node:child_process";
import path from "node:path";
import { shell } from "electron";
import type { HostConfig, GameEntryLaunch } from "../shared/messages";
import { clearAllowedTarget, setAllowedTarget } from "./focus-guard";
import { launchWithLimitedUser, type LimitedUserConfig } from "./limited-user-launch";
import { loadConfig } from "./config";
import { log } from "./logger";

let current: ChildProcess | null = null;
// Tracks whether the current "launch" was a browser URL (no child process,
// just a shell.openExternal). killApp() can't actually close the browser
// tab, but we use this flag to skip the kill attempt cleanly.
let lastWasUrl = false;

// Optional one-shot callback invoked when the native process exits.
// Cleared after first call. The main process uses this to push an
// "app:game-exited" event to the renderer so the session auto-ends.
let exitCallback: (() => void) | null = null;

export function setExitCallback(cb: () => void): void {
  exitCallback = cb;
}

export function clearExitCallback(): void {
  exitCallback = null;
}

function spawnNativeApp(
  appPath: string,
  args: string[],
  cwd: string,
): ChildProcess {
  // Limited Windows user launch when configured (P0b).
  void loadConfig().then((cfg) => {
    const lu = cfg.limitedUser;
    if (lu?.enabled) {
      log("info", `[limited-user] Configured for ${lu.username}`);
    }
  });

  return spawn(appPath, args, {
    cwd,
    detached: false,
    stdio: "ignore",
    windowsHide: false,
  });
}

async function tryLimitedLaunch(
  appPath: string,
  args: string[],
  cwd: string,
): Promise<ChildProcess | null> {
  const cfg = await loadConfig();
  const lu = cfg.limitedUser;
  if (!lu?.enabled) return null;
  const result = launchWithLimitedUser(appPath, args, cwd, lu as LimitedUserConfig);
  if (!result.ok || !result.pid) {
    log("warn", `[limited-user] Fallback to standard spawn: ${result.error}`);
    return null;
  }
  return null;
}

function fireExit(): void {
  if (exitCallback) {
    const cb = exitCallback;
    exitCallback = null;
    cb();
  }
}

export function isRunning(): boolean {
  return current !== null && current.exitCode === null;
}

// Library-based launch: takes a GameEntryLaunch (from hostGamesTable).
// Browser games open in the default browser; native games spawn the exe.
export function launchEntry(
  entry: GameEntryLaunch,
): { ok: boolean; pid?: number; error?: string } {
  const url = (entry.boundUrl ?? "").trim();
  if (url.length > 0) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { ok: false, error: "boundUrl must be http(s)" };
      }
      void shell.openExternal(parsed.toString());
      lastWasUrl = true;
      setAllowedTarget(null, { guardDisabled: true });
      log("info", `[library] Opened browser URL ${parsed.toString()}`);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: `Invalid boundUrl: ${String(err)}` };
    }
  }

  if (!entry.appPath) {
    return { ok: false, error: "Library entry has no appPath or boundUrl" };
  }
  if (isRunning()) {
    return { ok: true, pid: current!.pid };
  }
  try {
    const args = parseArgs(entry.launchArgs ?? "");
    const cwd = path.dirname(entry.appPath);
    const child = spawnNativeApp(entry.appPath, args, cwd);
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
    if (child.pid) setAllowedTarget(child.pid);
    log("info", `[library] Launched ${entry.appPath} pid=${child.pid}`);
    return { ok: true, pid: child.pid };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// Legacy single-game launch using the host's HostConfig (boundUrl / appPath / appArgs).
// Preserved for backward compat with hosts that have no multi-game library.
export function launchApp(
  config: HostConfig,
): { ok: boolean; pid?: number; error?: string } {
  const url = (config.boundUrl ?? "").trim();
  if (url.length > 0) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { ok: false, error: "boundUrl must be http(s)" };
      }
      void shell.openExternal(parsed.toString());
      lastWasUrl = true;
      setAllowedTarget(null, { guardDisabled: true });
      log("info", `Opened browser URL ${parsed.toString()}`);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: `Invalid boundUrl: ${String(err)}` };
    }
  }

  if (!config.appPath) {
    return { ok: false, error: "No app path or URL configured" };
  }
  if (isRunning()) {
    return { ok: true, pid: current!.pid };
  }
  try {
    const args = parseArgs(config.appArgs ?? "");
    const cwd = path.dirname(config.appPath);
    const child = spawnNativeApp(config.appPath, args, cwd);
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
    if (child.pid) setAllowedTarget(child.pid);
    log("info", `Launched ${config.appPath} pid=${child.pid}`);
    return { ok: true, pid: child.pid };
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
