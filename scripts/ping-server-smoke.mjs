#!/usr/bin/env node
/**
 * Фаза 4: standalone ping-server на :18080 (без Electron).
 */
import { createPingServer } from "../artifacts/host-agent/dist/main/main/ping-server.js";

const PORT = Number(process.env.PING_PORT ?? 18080);
const HOST = process.env.PING_HOST ?? "127.0.0.1";

const server = createPingServer({
  getInfo: async () => ({ version: "smoke-1", audioMode: "off" }),
  injectInput: () => {},
  log: () => {},
});

await new Promise((resolve, reject) => {
  server.listen(PORT, HOST, () => resolve());
  server.on("error", reject);
});

const base = `http://${HOST}:${PORT}`;

try {
  const pingRes = await fetch(`${base}/ping`);
  if (pingRes.status !== 200) {
    throw new Error(`GET /ping -> ${pingRes.status}`);
  }
  const pingBody = await pingRes.json();
  if (pingBody.status !== "ok") {
    throw new Error(`GET /ping body.status != ok`);
  }
  console.log("OK  GET /ping");

  const inputRes = await fetch(`${base}/input`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "mousemove", x: 0.5, y: 0.5 }),
  });
  if (inputRes.status !== 204) {
    throw new Error(`POST /input -> ${inputRes.status}`);
  }
  console.log("OK  POST /input -> 204");

  console.log("Done — ping-server smoke passed.");
} finally {
  await new Promise((resolve) => server.close(() => resolve()));
}
