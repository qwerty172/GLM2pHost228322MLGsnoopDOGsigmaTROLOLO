#!/usr/bin/env node
/**
 * pnpm smoke — быстрый smoke-тест API (healthz, games, register).
 */
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.argv[2] ?? "http://localhost:8080";

const script =
  process.platform === "win32"
    ? join(ROOT, "scripts/smoke-api.bat")
    : join(ROOT, "scripts/smoke-api.sh");

try {
  execSync(`"${script}" "${BASE}"`, { cwd: ROOT, stdio: "inherit" });
} catch {
  process.exit(1);
}
