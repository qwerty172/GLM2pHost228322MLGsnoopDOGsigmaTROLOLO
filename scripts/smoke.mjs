#!/usr/bin/env node
/**
 * Smoke-тест API (фаза 1) — API должен быть запущен.
 * Usage: node scripts/smoke.mjs [baseUrl]
 */
const BASE = process.argv[2] ?? process.env.API_BASE ?? "http://localhost:8080";

async function check(method, path, expected = 200, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const ok =
    String(res.status) === String(expected) ||
    (expected === "2xx" && res.status >= 200 && res.status < 300);
  const label = `${method} ${path} -> ${res.status}`;
  if (ok) {
    console.log(`OK  ${label}`);
    return true;
  }
  console.error(`FAIL ${label} (ожидалось ${expected})`);
  return false;
}

console.log(`Smoke-test: ${BASE}\n`);

let failed = 0;
const run = async (fn) => {
  if (!(await fn())) failed++;
};

await run(() => check("GET", "/api/healthz"));
await run(() => check("GET", "/api/games"));
await run(() => check("GET", "/api/games/rogue-fable-3"));
await run(() => check("GET", "/api/hosts"));
await run(() => check("GET", "/api/quotas"));
await run(() => check("GET", "/api/loans/requests"));
await run(() => check("POST", "/api/players/register", 201, { guest: true }));

if (failed) {
  console.error(`\n${failed} проверок не прошло`);
  process.exit(1);
}
console.log("\nDone.");
