#!/usr/bin/env node
/** Кроссплатформенный первичный setup */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env");
const envExample = path.join(root, ".env.example");

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log("==> DecentralHub — быстрый setup\n");

if (!existsSync(envPath)) {
  copyFileSync(envExample, envPath);
  console.log("Создан .env из .env.example");
} else {
  console.log(".env уже есть — не перезаписываем");
}

run("node", ["scripts/generate-secrets.mjs", envPath]);
run("node", ["scripts/ensure-docker-deps.mjs"]);

console.log("\n==> pnpm install");
run("pnpm", ["install"]);

console.log("\n==> Схема БД (pnpm --filter @workspace/db run push)");
const db = spawnSync("pnpm", ["--filter", "@workspace/db", "run", "push"], {
  cwd: root,
  stdio: "inherit",
});
if (db.status !== 0) {
  console.error(
    "\nОшибка db push. Проверь DATABASE_URL в .env и что Postgres запущен.\n" +
      "С Docker: docker compose -f infra/docker-compose.dev.yml up -d postgres\n" +
      "Повтори: pnpm setup",
  );
  process.exit(1);
}

console.log("\n✓ Готово. Запуск: pnpm dev");
console.log("  Web:  http://localhost:5000");
console.log("  API:  http://localhost:8080/api/healthz");
console.log("  Игра: http://localhost:5000/games (Rogue Fable III в браузере)");
console.log("\nОпционально: pnpm run typecheck — полная проверка типов");
