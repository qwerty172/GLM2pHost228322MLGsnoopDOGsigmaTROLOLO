#!/usr/bin/env node
/**
 * Проверяет доступность PostgreSQL (TCP) по DATABASE_URL из .env.
 * exit 0 — порт отвечает, exit 1 — нет.
 */
import { readFileSync, existsSync } from "node:fs";
import net from "node:net";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const envPath = resolve(root, ".env");
  if (!existsSync(envPath)) return null;

  const match = readFileSync(envPath, "utf8").match(/^DATABASE_URL=(.+)$/m);
  return match?.[1]?.trim() || null;
}

function parseHostPort(databaseUrl) {
  try {
    const normalized = databaseUrl.replace(/^postgresql:/, "postgres:");
    const url = new URL(normalized);
    return {
      host: url.hostname || "localhost",
      port: Number(url.port || 5432),
    };
  } catch {
    return null;
  }
}

function tcpProbe(host, port, timeoutMs) {
  return new Promise((resolveProbe) => {
    const socket = net.connect({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      resolveProbe(false);
    }, timeoutMs);

    socket.on("connect", () => {
      clearTimeout(timer);
      socket.end();
      resolveProbe(true);
    });
    socket.on("error", () => {
      clearTimeout(timer);
      resolveProbe(false);
    });
  });
}

const databaseUrl = loadDatabaseUrl();
if (!databaseUrl) {
  console.error("pg-probe: DATABASE_URL не задан");
  process.exit(1);
}

const endpoint = parseHostPort(databaseUrl);
if (!endpoint) {
  console.error("pg-probe: не удалось разобрать DATABASE_URL");
  process.exit(1);
}

const timeoutMs = Number(process.env.PG_PROBE_TIMEOUT_MS ?? 3000);
const ok = await tcpProbe(endpoint.host, endpoint.port, timeoutMs);

if (!ok) {
  console.error(
    `pg-probe: PostgreSQL недоступен (${endpoint.host}:${endpoint.port})`,
  );
  process.exit(1);
}

process.exit(0);
