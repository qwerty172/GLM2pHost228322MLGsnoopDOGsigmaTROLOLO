#!/usr/bin/env node
/**
 * Заполняет пустые WALLET_ENCRYPTION_KEY и JWT_SECRET в .env
 * (идемпотентно — не перезаписывает уже заданные значения)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";

const envPath = path.resolve(process.argv[2] ?? ".env");
let content = readFileSync(envPath, "utf8");
let changed = false;

function ensureSecret(key) {
  const lineRe = new RegExp(`^${key}=(.*)$`, "m");
  const match = content.match(lineRe);
  if (!match) return;
  const value = match[1]?.trim() ?? "";
  if (value) return;
  const generated = randomBytes(32).toString("hex");
  content = content.replace(lineRe, `${key}=${generated}`);
  changed = true;
  console.log(`Сгенерирован ${key}`);
}

ensureSecret("WALLET_ENCRYPTION_KEY");
ensureSecret("JWT_SECRET");

if (changed) {
  writeFileSync(envPath, content);
}
