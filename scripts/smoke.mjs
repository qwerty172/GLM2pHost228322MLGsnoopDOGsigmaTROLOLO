#!/usr/bin/env node
/**
 * Cross-platform API smoke test (фаза 1 TESTPLAN).
 */
import { readEnvFile, die, log } from "./lib/dx.mjs";

const env = readEnvFile();
const base =
  process.argv[2] ??
  process.env.API_BASE ??
  `http://localhost:${env.PORT || "8080"}`;

async function check(method, path, expected = 200, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const ok =
    String(res.status) === String(expected) ||
    (expected === "2xx" && res.status >= 200 && res.status < 300);
  if (ok) {
    log(`OK   ${method} ${path} → ${res.status}`);
    return;
  }
  const text = await res.text();
  throw new Error(
    `FAIL ${method} ${path} → ${res.status} (ожидалось ${expected}): ${text.slice(0, 200)}`,
  );
}

async function main() {
  log(`Smoke-test: ${base}\n`);
  await check("GET", "/api/healthz");
  await check("GET", "/api/games");
  await check("GET", "/api/games/rogue-fable-3");
  await check("GET", "/api/hosts");
  await check("GET", "/api/quotas");
  await check("GET", "/api/loans/requests");
  await check("POST", "/api/players/register", 201, { guest: true });
  log("\nDone.");
}

main().catch((e) => die(e.message ?? String(e)));
