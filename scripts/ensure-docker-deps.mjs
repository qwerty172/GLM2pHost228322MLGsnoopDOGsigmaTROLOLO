#!/usr/bin/env node
/**
 * Поднимает Postgres + Redis через docker compose, если Docker доступен.
 * Возвращает 0 даже если Docker нет — тогда разработчик ставит Postgres вручную.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const composeFile = path.join(root, "infra", "docker-compose.dev.yml");

if (!existsSync(composeFile)) {
  process.exit(0);
}

const docker = spawnSync("docker", ["info"], { stdio: "ignore" });
if (docker.status !== 0) {
  console.log(
    "Docker не найден — пропускаем контейнеры. Установи PostgreSQL вручную или Docker Desktop.",
  );
  process.exit(0);
}

console.log("==> Docker: postgres + redis (infra/docker-compose.dev.yml)");
const up = spawnSync(
  "docker",
  ["compose", "-f", composeFile, "up", "-d", "postgres", "redis"],
  { cwd: root, stdio: "inherit" },
);

if (up.status !== 0) {
  console.warn(
    "Не удалось поднять docker compose — проверь Docker или DATABASE_URL в .env",
  );
  process.exit(0);
}

console.log("Postgres: postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub");
console.log("Ждём готовности Postgres…");
for (let i = 0; i < 30; i++) {
  const ready = spawnSync(
    "docker",
    [
      "compose",
      "-f",
      composeFile,
      "exec",
      "-T",
      "postgres",
      "pg_isready",
      "-U",
      "decentral_hub",
    ],
    { cwd: root, stdio: "ignore" },
  );
  if (ready.status === 0) {
    console.log("Postgres готов.");
    process.exit(0);
  }
  spawnSync("sleep", ["1"], { stdio: "ignore" });
}
console.warn("Postgres ещё стартует — db push может потребовать повторного запуска setup.");
