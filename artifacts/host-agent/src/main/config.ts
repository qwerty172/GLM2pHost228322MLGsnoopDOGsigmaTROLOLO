import { app } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { HostConfig } from "../shared/messages";

const DEFAULTS: HostConfig = {
  hostToken: "",
  apiBaseUrl: "",
  signalingUrl: "",
  appPath: "",
  appArgs: "",
  appName: "",
  ratePerMinute: 0.05,
  resolution: { width: 1920, height: 1080 },
  bitrateKbps: 6000,
  killAppOnDisconnect: false,
  autoLaunchAtStartup: true,
};

let cached: HostConfig | null = null;

function configPath(): string {
  return path.join(app.getPath("userData"), "config.json");
}

export async function loadConfig(): Promise<HostConfig> {
  if (cached) return cached;
  try {
    const buf = await fs.readFile(configPath(), "utf-8");
    const parsed = JSON.parse(buf) as Partial<HostConfig>;
    cached = { ...DEFAULTS, ...parsed };
  } catch {
    cached = { ...DEFAULTS };
  }
  return cached;
}

export async function saveConfig(next: HostConfig): Promise<HostConfig> {
  cached = { ...DEFAULTS, ...next };
  await fs.mkdir(path.dirname(configPath()), { recursive: true });
  await fs.writeFile(configPath(), JSON.stringify(cached, null, 2), "utf-8");
  return cached;
}

export function getCachedConfig(): HostConfig | null {
  return cached;
}
