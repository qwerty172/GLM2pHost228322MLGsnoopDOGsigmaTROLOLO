#!/usr/bin/env node
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const base = process.argv[2] ?? "http://localhost:8080";
const script = join(ROOT, "scripts/smoke-api.sh");

const child = spawn("bash", [script, base], {
  cwd: ROOT,
  stdio: "inherit",
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
