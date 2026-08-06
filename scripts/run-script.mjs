#!/usr/bin/env node
/**
 * Кроссплатформенный запуск scripts/*.sh или scripts/*.bat из корневых pnpm-скриптов.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [, , name, ...extraArgs] = process.argv;
if (!name) {
  console.error("Usage: node scripts/run-script.mjs <script-name> [args...]");
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";
const script = path.join(root, "scripts", `${name}${isWin ? ".bat" : ".sh"}`);

const result = isWin
  ? spawnSync("cmd", ["/c", script, ...extraArgs], { stdio: "inherit", cwd: root })
  : spawnSync("bash", [script, ...extraArgs], { stdio: "inherit", cwd: root });

process.exit(result.status ?? 1);
