import { spawn, ChildProcess } from "node:child_process";
import path from "node:path";
import type { HostConfig } from "../shared/messages";
import { log } from "./logger";

let current: ChildProcess | null = null;

export function isRunning(): boolean {
  return current !== null && current.exitCode === null;
}

export function launchApp(
  config: HostConfig,
): { ok: boolean; pid?: number; error?: string } {
  if (!config.appPath) {
    return { ok: false, error: "No app path configured" };
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
  if (!current) return;
  try {
    current.kill();
  } catch (err) {
    log("warn", `Failed to kill app: ${String(err)}`);
  }
  current = null;
}
