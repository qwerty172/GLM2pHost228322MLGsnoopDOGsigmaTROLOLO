#!/usr/bin/env node
/**
 * pnpm smoke — быстрая проверка что API жив.
 * Использование: pnpm smoke [baseUrl]
 */
import { parseArgs } from "./lib/dx.mjs";

const { positional } = parseArgs(process.argv.slice(2));
const BASE = positional[0] ?? process.env.API_BASE ?? "http://localhost:8080";

async function check(method, path, expected = 200, body) {
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
    return;
  }
  const text = await res.text();
  console.error(`FAIL ${method} ${path} -> ${res.status} (expected ${expected})`);
  if (text) console.error(text.slice(0, 200));
  process.exit(1);
}

console.log(`Smoke-test: ${BASE}`);
await check("GET", "/api/healthz");
await check("GET", "/api/games");
await check("GET", "/api/games/rogue-fable-3");
await check("GET", "/api/hosts");
await check("GET", "/api/quotas");
await check("GET", "/api/loans/requests");
await check("POST", "/api/players/register", 201, { guest: true });
console.log("Done.");
