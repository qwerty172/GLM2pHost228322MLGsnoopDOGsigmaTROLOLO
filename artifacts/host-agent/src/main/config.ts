import { app, safeStorage } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { HostConfig } from "../shared/messages";
import { log } from "./logger";

const DEFAULTS: HostConfig = {
  hostToken: "",
  apiBaseUrl: "",
  signalingUrl: "",
  appPath: "",
  appArgs: "",
  appName: "",
  captureSourceName: "",
  ratePerMinute: 0.05,
  commissionSplit: 0.7,
  resolution: { width: 1920, height: 1080 },
  bitrateKbps: 6000,
  killAppOnDisconnect: false,
  autoLaunchAtStartup: true,
  autoQuotaEnabled: false,
  audioMode: "off",
};

/** On-disk shape: hostToken may be stored encrypted as hostTokenEnc. */
interface StoredConfigFile extends Partial<HostConfig> {
  hostTokenEnc?: string;
  /** When true, hostToken field on disk is intentionally empty (enc used). */
  hostTokenProtected?: boolean;
}

let cached: HostConfig | null = null;

function configPath(): string {
  return path.join(app.getPath("userData"), "config.json");
}

function encryptToken(plain: string): string | null {
  if (!plain) return null;
  try {
    if (!safeStorage.isEncryptionAvailable()) return null;
    return safeStorage.encryptString(plain).toString("base64");
  } catch (err) {
    log("warn", `[config] safeStorage encrypt failed: ${String(err)}`);
    return null;
  }
}

function decryptToken(encB64: string): string | null {
  try {
    if (!safeStorage.isEncryptionAvailable()) return null;
    const buf = Buffer.from(encB64, "base64");
    return safeStorage.decryptString(buf);
  } catch (err) {
    log("warn", `[config] safeStorage decrypt failed: ${String(err)}`);
    return null;
  }
}

function resolveHostToken(parsed: StoredConfigFile): string {
  if (parsed.hostTokenEnc) {
    const dec = decryptToken(parsed.hostTokenEnc);
    if (dec !== null) return dec;
  }
  // Legacy plaintext migration path.
  return typeof parsed.hostToken === "string" ? parsed.hostToken : "";
}

function toDiskPayload(cfg: HostConfig): StoredConfigFile {
  const { hostToken, ...rest } = cfg;
  const enc = encryptToken(hostToken);
  if (enc) {
    return {
      ...rest,
      hostToken: "",
      hostTokenEnc: enc,
      hostTokenProtected: true,
    };
  }
  // Encryption unavailable (e.g. CI / Linux without keyring) — keep plaintext.
  return { ...rest, hostToken };
}

async function loadBundleDefaults(): Promise<Partial<HostConfig>> {
  try {
    const bundlePath = path.join(app.getAppPath(), "bundle-defaults.json");
    const buf = await fs.readFile(bundlePath, "utf-8");
    const parsed = JSON.parse(buf) as Partial<HostConfig>;
    if (typeof parsed.apiBaseUrl === "string" && parsed.apiBaseUrl.trim()) {
      return { apiBaseUrl: parsed.apiBaseUrl.trim() };
    }
  } catch {
    // Portable ZIP may ship without bundle defaults.
  }
  return {};
}

export async function loadConfig(): Promise<HostConfig> {
  if (cached) return cached;
  const bundleDefaults = await loadBundleDefaults();
  try {
    const buf = await fs.readFile(configPath(), "utf-8");
    const parsed = JSON.parse(buf) as StoredConfigFile;
    const hostToken = resolveHostToken(parsed);
    cached = { ...DEFAULTS, ...bundleDefaults, ...parsed, hostToken };
    if (!cached.apiBaseUrl && bundleDefaults.apiBaseUrl) {
      cached.apiBaseUrl = bundleDefaults.apiBaseUrl;
    }
    // Drop disk-only fields from runtime object.
    delete (cached as StoredConfigFile).hostTokenEnc;
    delete (cached as StoredConfigFile).hostTokenProtected;

    // Migrate plaintext → encrypted on next successful load when possible.
    if (
      hostToken &&
      !parsed.hostTokenEnc &&
      safeStorage.isEncryptionAvailable()
    ) {
      await persist(cached);
    }
  } catch {
    cached = { ...DEFAULTS, ...bundleDefaults };
  }
  return cached;
}

async function persist(cfg: HostConfig): Promise<void> {
  await fs.mkdir(path.dirname(configPath()), { recursive: true });
  await fs.writeFile(
    configPath(),
    JSON.stringify(toDiskPayload(cfg), null, 2),
    "utf-8",
  );
}

export async function saveConfig(next: HostConfig): Promise<HostConfig> {
  cached = { ...DEFAULTS, ...next };
  await persist(cached);
  return cached;
}

export function getCachedConfig(): HostConfig | null {
  return cached;
}
