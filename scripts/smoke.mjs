#!/usr/bin/env node
/**
 * pnpm smoke — быстрый smoke-тест API (healthz, games, register).
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const base = process.argv[2] ?? "http://localhost:8080";

const script =
  process.platform === "win32"
    ? join(ROOT, "scripts/smoke-api.bat")
  : join(ROOT, "scripts/smoke-api.sh");

const r =
  process.platform === "win32"
    ? spawnSync("cmd", ["/c", script, base], { cwd: ROOT, stdio: "inherit" })
    : spawnSync(script, [base], { cwd: ROOT, stdio: "inherit" });

process.exit(r.status ?? 1);
