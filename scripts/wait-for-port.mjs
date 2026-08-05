#!/usr/bin/env node
/** Ждёт, пока TCP-порт станет доступен (для postgres после docker up). */
import net from "node:net";

const [host = "127.0.0.1", portStr = "5432", timeoutStr = "60000"] = process.argv.slice(2);
const port = Number(portStr);
const timeoutMs = Number(timeoutStr);
const start = Date.now();

function tryConnect() {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port }, () => {
      socket.end();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function main() {
  while (Date.now() - start < timeoutMs) {
    if (await tryConnect()) {
      console.log(`Порт ${host}:${port} доступен`);
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  console.error(`Таймаут: порт ${host}:${port} не открылся за ${timeoutMs}ms`);
  process.exit(1);
}

main();
