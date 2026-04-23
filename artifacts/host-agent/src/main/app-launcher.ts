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
    const args = (config.appArgs ?? "").trim().length
      ? config.appArgs!.split(" ").filter(Boolean)
      : [];
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

export function killApp(): void {
  if (!current) return;
  try {
    current.kill();
  } catch (err) {
    log("warn", `Failed to kill app: ${String(err)}`);
  }
  current = null;
}
