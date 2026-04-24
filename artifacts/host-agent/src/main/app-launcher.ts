import { spawn, ChildProcess } from "node:child_process";
import path from "node:path";
import { shell } from "electron";
import type { HostConfig } from "../shared/messages";
import { log } from "./logger";

let current: ChildProcess | null = null;
// Tracks whether the current "launch" was a browser URL (no child process,
// just a shell.openExternal). killApp() can't actually close the browser
// tab, but we use this flag to skip the kill attempt cleanly.
let lastWasUrl = false;

export function isRunning(): boolean {
  return current !== null && current.exitCode === null;
}

export function launchApp(
  config: HostConfig,
): { ok: boolean; pid?: number; error?: string } {
  // Browser game takes precedence: open the URL in the host's default
  // browser. We don't keep a handle to the spawned browser, so this also
  // makes killApp a no-op for URL bindings.
  const url = (config.boundUrl ?? "").trim();
  if (url.length > 0) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { ok: false, error: "boundUrl must be http(s)" };
      }
      void shell.openExternal(parsed.toString());
      lastWasUrl = true;
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
    const child = spawn(config.appPath, args, {
      cwd,
      detached: false,
      stdio: "ignore",
      windowsHide: false,
    });
    child.on("exit", (code, signal) => {
      log("info", `Target app exited code=${code} signal=${signal}`);
      current = null;
    });
    child.on("error", (err) => {
      log("error", `Target app error: ${String(err)}`);
      current = null;
    });
    current = child;
    lastWasUrl = false;
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
