#!/usr/bin/env node
/** Кроссплатформенный запуск dev-local (API + Web) */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";
const script = path.join(root, "scripts", isWin ? "dev-local.bat" : "dev-local.sh");

if (!existsSync(path.join(root, ".env"))) {
  console.error("Нет .env — сначала: pnpm setup");
  process.exit(1);
}

const child = spawn(script, [], {
  cwd: root,
  stdio: "inherit",
  shell: isWin,
});

child.on("exit", (code) => process.exit(code ?? 0));
