import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const COMPOSE_FILE = path.resolve("infra/docker-compose.dev.yml");

/** @returns {boolean} */
export function hasDocker() {
  const r = spawnSync("docker", ["info"], { stdio: "ignore" });
  return r.status === 0;
}

/** @returns {boolean} */
export function hasComposeFile() {
  return existsSync(COMPOSE_FILE);
}

/**
 * @param {string[]} services
 * @returns {boolean}
 */
export function dockerComposeUp(services) {
  const args = ["compose", "-f", COMPOSE_FILE, "up", "-d", ...services];
  const r = spawnSync("docker", args, { stdio: "inherit" });
  return r.status === 0;
}

/**
 * @param {string} service
 * @param {number} timeoutMs
 * @returns {Promise<boolean>}
 */
export async function waitForPostgres(service = "postgres", timeoutMs = 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const r = spawnSync(
      "docker",
      ["compose", "-f", COMPOSE_FILE, "exec", "-T", service, "pg_isready", "-U", "decentral_hub"],
      { stdio: "ignore" },
    );
    if (r.status === 0) return true;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return false;
}
