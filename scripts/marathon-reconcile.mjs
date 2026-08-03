#!/usr/bin/env node
// Reconcile MARATHON.md pending tasks against the `main` codebase.
//
// Usage:
//   node scripts/marathon-reconcile.mjs            # print report
//   node scripts/marathon-reconcile.mjs --apply     # rewrite MARATHON.md statuses
//
// Source of truth is the working tree (== main after `git pull`).
// Open PRs / unmerged branches are NOT considered done — only code in main.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

const MARATHON = "MARATHON.md";
const APPLY = process.argv.includes("--apply");

// task ID -> evidence that the work landed in main.
// `files`: paths that must exist. `grep`: regex that must match somewhere under path.
const EVIDENCE = {
  "C1-F05": { files: ["artifacts/api-server/src/lib/authMiddleware.ts"] },
  "C2-S06": { grep: { path: "artifacts/web/src/App.tsx", re: /host\/wallet/ } },
  "C2-S07": { grep: { path: "artifacts/web/src/components/ui", re: /Закрыть|Переключить боковую панель/ } },
  "C2-D02": { files: ["lib/api-zod/src/generated/types/authLoginBody.ts"] },
  "C3-S05": { grep: { path: "artifacts/host-agent/src/main/app-launcher.ts", re: /await tryLimitedLaunch/ } },
  "C3-S06": { grep: { path: "artifacts/host-agent/src/main", re: /syncRtmp|restartRtmp/i } },
  "C3-S07": { grep: { path: "artifacts/host-agent/electron-builder.yml", re: /ViGEmClient\.dll/ } },
  "C3-S08": { files: ["artifacts/host-agent/src/renderer/session.ts"] },
  "C4-S02": {
    files: [
      "lib/api-zod/src/generated/types/agentTelemetryBody.ts",
      "lib/api-zod/src/generated/types/agentPairBody.ts",
      "lib/api-zod/src/generated/types/devKeyCreateBody.ts",
    ],
    grep: { path: "lib/api-spec/openapi.yaml", re: /\/agent-telemetry:|\/dev-keys:/ },
  },
  "C4-S07": { grep: { path: "tsconfig.json", re: /api-client-react/ } },
  "UX-02": { grep: { path: "artifacts/web/src/pages/host/dashboard.tsx", re: /AgentTroubleshootChecklist/ } },
  "UX-03": { files: ["artifacts/web/src/lib/connection-labels.ts"] },
  "UX-05": { files: ["artifacts/web/src/lib/quota-compatibility.ts"] },
  "UX-06": { files: ["artifacts/web/src/lib/api-errors.ts"] },
};

function rg(re, path) {
  try {
    const out = execSync(`rg -l "${re.source}" "${path}" 2>/dev/null`, { encoding: "utf8" });
    return out.trim().length > 0;
  } catch {
    return false;
  }
}

function check(ev) {
  if (ev.note) return { ok: false, manual: true, note: ev.note };
  if (ev.files) {
    const missing = ev.files.filter((f) => !existsSync(f));
    if (missing.length) return { ok: false, note: `missing: ${missing.join(", ")}` };
  }
  if (ev.grep) {
    const found = rg(ev.grep.re, ev.grep.path);
    if (!found) return { ok: false, note: `no match in ${ev.grep.path}` };
  }
  if (ev.files || ev.grep) return { ok: true };
  return { ok: false, note: "no evidence defined" };
}

function parseTasks(md) {
  // match table rows: | ID | ... | status | ...   (status is 4th-ish column)
  const rows = [];
  for (const line of md.split("\n")) {
    const m = line.match(/^\|\s*([A-Z]\d+-[A-Z]\d+|UX-\d+)\s*\|(.*)$/);
    if (!m) continue;
    const rest = m[2];
    // find a status token in the row
    const statusMatch = rest.match(/\|\s*(pending|in_progress|done|blocked|skipped)\s*\|/i);
    const status = statusMatch ? statusMatch[1].toLowerCase() : "";
    rows.push({ id: m[1], line, status });
  }
  return rows;
}

const md = readFileSync(MARATHON, "utf8");
const tasks = parseTasks(md);

console.log("=== MARATHON reconcile (source: main working tree) ===\n");
const flips = [];
for (const t of tasks) {
  if (!EVIDENCE[t.id]) continue;
  const res = check(EVIDENCE[t.id]);
  const want = res.ok ? "done" : t.status;
  const flag = res.ok && t.status !== "done" ? "  → SHOULD BE done" : "";
  const note = res.note ? ` ${res.note}` : "";
  console.log(`${t.id.padEnd(8)} status=${t.status.padEnd(11)} evidence=${res.ok ? "PASS" : "FAIL"}${res.manual ? " (manual)" : ""}${note}${flag}`);
  if (res.ok && t.status !== "done") flips.push({ id: t.id, line: t.line });
}

console.log(`\n${flips.length} task(s) should flip to done.`);
const doneCount = tasks.filter((t) => t.status === "done" && EVIDENCE[t.id]).length;
console.log(`${doneCount} legacy task(s) with evidence marked done — automation MUST NOT re-run them.`);
if (!APPLY) {
  console.log("Run with --apply to rewrite MARATHON.md statuses.");
} else if (flips.length) {
  let out = md;
  for (const f of flips) {
    out = out.replace(f.line, (l) => l.replace(/\|\s*pending\s*\|/i, "| done |").replace(/\|\s*in_progress\s*\|/i, "| done |"));
  }
  writeFileSync(MARATHON, out);
  console.log("MARATHON.md updated.");
}
