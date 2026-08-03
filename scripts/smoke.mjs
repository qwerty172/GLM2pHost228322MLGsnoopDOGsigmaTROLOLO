#!/usr/bin/env node
/**
 * Smoke-тест API (фаза 1 TESTPLAN). API должен быть на :8080.
 * pnpm smoke
 */
const BASE = process.argv[2] ?? process.env.API_BASE ?? "http://localhost:8080";

const checks = [
  ["GET", "/api/healthz", 200],
  ["GET", "/api/games", 200],
  ["GET", "/api/games/rogue-fable-3", 200],
  ["GET", "/api/hosts", 200],
  ["GET", "/api/quotas", 200],
  ["GET", "/api/loans/requests", 200],
  ["POST", "/api/players/register", 201, { guest: true }],
];

async function check(method, path, expected, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const ok =
    String(res.status) === String(expected) ||
    (expected === "2xx" && res.status >= 200 && res.status < 300);
  if (ok) {
    console.log(`OK  ${method} ${path} -> ${res.status}`);
    return true;
  }
  console.error(`FAIL ${method} ${path} -> ${res.status} (expected ${expected})`);
  return false;
}

async function main() {
  console.log(`Smoke-test: ${BASE}`);
  let failed = false;
  for (const [method, path, expected, body] of checks) {
    if (!(await check(method, path, expected, body))) {
      failed = true;
    }
  }
  if (failed) {
    console.error("\nSmoke-тест провален. API запущен? → pnpm dev");
    process.exit(1);
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err.message ?? err);
  console.error("\nНе удалось подключиться к API. Запусти: pnpm dev");
  process.exit(1);
});
