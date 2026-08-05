#!/usr/bin/env node
// Thin wrapper — обновить Last run в MARATHON.md в том же коммите, что и feat.
// Usage: node scripts/marathon-last-run.mjs --task M-90 --result "..." [--commit abc]

import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const r = spawnSync("node", ["scripts/marathon-efficiency.mjs", "--update-last-run", ...args], {
  encoding: "utf8",
  stdio: "inherit",
});
process.exit(r.status ?? 1);
