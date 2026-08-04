/**
 * Shared API helpers for smoke scripts — reuse DB hosts when register is rate-limited.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.API_BASE ?? "http://localhost:8080";

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = readFileSync(join(ROOT, ".env"), "utf8");
  const line = env.split("\n").find((l) => l.startsWith("DATABASE_URL="));
  return line?.slice("DATABASE_URL=".length) ?? "";
}

export async function api(method, path, body, headers = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, json, text };
}

export async function getPlayerWalletToken() {
  const { ok, json, text } = await api("POST", "/api/players/register", {
    guest: true,
  });
  if (!ok) throw new Error(`player register -> ${text}`);
  return json.playerToken;
}

export async function getHostToken() {
  const { ok, json, text, status } = await api("POST", "/api/hosts/register", {
    displayName: `Smoke ${Date.now()}`,
  });
  if (ok) return json.hostToken;
  if (status === 429) {
    const db = databaseUrl();
    const token = execSync(
      `psql "${db}" -tAc "SELECT h.host_token FROM hosts h WHERE NOT EXISTS (SELECT 1 FROM sessions s WHERE s.host_id = h.id AND s.status <> 'ended') ORDER BY h.created_at DESC LIMIT 1;"`,
      { encoding: "utf8" },
    ).trim();
    if (token) return token;
  }
  throw new Error(`host register -> ${text}`);
}

export { BASE };
