/**
 * Shared .env read/write helpers for bootstrap / doctor scripts.
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import { join } from "node:path";

export function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq);
    let val = trimmed.slice(eq + 1);
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

export function setEnvValue(path, key, value) {
  const content = existsSync(path) ? readFileSync(path, "utf8") : "";
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  const next = re.test(content)
    ? content.replace(re, line)
    : content.endsWith("\n") || content.length === 0
      ? `${content}${line}\n`
      : `${content}\n${line}\n`;
  writeFileSync(path, next, "utf8");
}

export function ensureEnvFile(root) {
  const envPath = join(root, ".env");
  const examplePath = join(root, ".env.example");
  if (!existsSync(envPath)) {
    copyFileSync(examplePath, envPath);
    return { created: true, path: envPath };
  }
  return { created: false, path: envPath };
}

export const DOCKER_PG_URL =
  "postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub";
