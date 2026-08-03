#!/usr/bin/env node
// Marathon meta-grooming: detect workflow drift, phantom tasks, stale state.
// Safe auto-fixes (--apply) only touch MARATHON.md statuses — not product code.
//
// Usage:
//   node scripts/marathon-groom.mjs           # report
//   node scripts/marathon-groom.mjs --apply   # fix MARATHON.md + optional scan sync hint

import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { execSync } from "node:child_process";

const MARATHON = "MARATHON.md";
const APPLY = process.argv.includes("--apply");
const STALE_HOURS = 24;

function loadState() {
  const r = spawnSync("node", ["scripts/marathon-scan.mjs", "--json-state"], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr || "marathon-scan --json-state failed");
  return JSON.parse(r.stdout);
}

function taskLastTouchMs(taskId) {
  try {
    const out = execSync(`git log -1 --format=%ct --grep="${taskId}" -- ${MARATHON}`, { encoding: "utf8" }).trim();
    return out ? parseInt(out, 10) * 1000 : 0;
  } catch {
    return 0;
  }
}

function replaceRowStatus(line, newStatus) {
  return line.replace(/\|\s*(pending|in_progress|done|blocked|skipped)\s*\|/i, `| ${newStatus} |`);
}

function replaceRowTitle(line, suffix) {
  const parts = line.split("|");
  if (parts.length < 4) return line;
  const title = parts[3].trim();
  if (title.includes(suffix)) return line;
  parts[3] = ` ${title} ${suffix} `;
  return parts.join("|");
}

const state = loadState();
const scannerKeys = new Set(state.scannerKeys);
const issues = [];
const fixes = [];

// 1. Phantom pending — в таблице, но сканер больше не видит проблему
for (const row of state.existingRows.filter((r) => r.status === "pending")) {
  if (!scannerKeys.has(row.groupKey)) {
    issues.push({ kind: "phantom_pending", id: row.id, groupKey: row.groupKey, msg: "pending в MARATHON, но сканер не находит — лишняя задача" });
    if (APPLY) fixes.push({ row, action: "skip", reason: "(groom: phantom)" });
  }
}

// 2. Stale in_progress — зависла >24ч без коммита с ID
const now = Date.now();
for (const row of state.existingRows.filter((r) => r.status === "in_progress")) {
  const touched = taskLastTouchMs(row.id);
  const ageH = touched ? (now - touched) / 3600000 : 999;
  if (ageH > STALE_HOURS) {
    issues.push({ kind: "stale_in_progress", id: row.id, ageH: Math.round(ageH), msg: `in_progress >${STALE_HOURS}ч без активности` });
    if (APPLY) fixes.push({ row, action: "pending", reason: "(groom: stale reset)" });
  }
}

// 3. Duplicate groupKey among pending
const seen = new Map();
for (const row of state.existingRows.filter((r) => r.status === "pending")) {
  if (seen.has(row.groupKey)) {
    issues.push({ kind: "duplicate_pending", id: row.id, dupOf: seen.get(row.groupKey), msg: "дубликат pending по Key" });
    if (APPLY) fixes.push({ row, action: "skip", reason: "(groom: duplicate)" });
  } else {
    seen.set(row.groupKey, row.id);
  }
}

// 4. Done but scanner still active — работа не зачтена / задача преждевременно done
for (const row of state.existingRows.filter((r) => r.status === "done")) {
  if (scannerKeys.has(row.groupKey)) {
    issues.push({ kind: "done_but_active", id: row.id, groupKey: row.groupKey, msg: "done, но сканер всё ещё видит проблему — reopen или улучшить сканер" });
    if (APPLY) fixes.push({ row, action: "pending", reason: "(groom: reopen)" });
  }
}

// 5. Queue drift — сканер нашёл новое, в таблице нет pending
const tablePendingKeys = new Set(state.existingRows.filter((r) => r.status === "pending").map((r) => r.groupKey));
const missingInTable = state.candidates.filter((c) => !tablePendingKeys.has(c.groupKey) && !state.existingRows.some((r) => r.groupKey === c.groupKey && ["done", "in_progress", "blocked"].includes(r.status)));
if (missingInTable.length) {
  issues.push({ kind: "queue_drift", count: missingInTable.length, msg: "сканер нашёл задачи, которых нет в таблице — нужен --sync-marathon" });
}

// 6. Raw explosion — плохая группировка
if (state.rawHits > 0 && state.grouped > 0 && state.rawHits / state.grouped > 4) {
  issues.push({ kind: "raw_explosion", raw: state.rawHits, grouped: state.grouped, msg: "слишком много raw vs grouped — улучшить marathon-scan.mjs" });
}

console.log("=== MARATHON groom ===\n");
for (const i of issues) {
  const fix = APPLY && fixes.some((f) => f.row?.id === i.id) ? " → FIX" : i.kind === "queue_drift" && APPLY ? " → run sync" : "";
  console.log(`${i.kind.padEnd(18)} ${i.id ?? ""} ${i.msg}${fix}`);
}
console.log(`\n${issues.length} issue(s), ${fixes.length} auto-fix(es)${APPLY ? " applied" : " available"}.`);

if (APPLY && fixes.length) {
  let md = readFileSync(MARATHON, "utf8");
  for (const f of fixes) {
    let newLine = f.row.line;
    if (f.action === "skip") {
      newLine = replaceRowStatus(newLine, "skipped");
      newLine = replaceRowTitle(newLine, f.reason);
    } else if (f.action === "pending") {
      newLine = replaceRowStatus(newLine, "pending");
      newLine = replaceRowTitle(newLine, f.reason);
    }
    md = md.replace(f.row.line, newLine);
  }
  writeFileSync(MARATHON, md);
  console.log("MARATHON.md updated.");
}

if (APPLY && missingInTable.length) {
  const sync = spawnSync("node", ["scripts/marathon-scan.mjs", "--sync-marathon"], { encoding: "utf8" });
  if (sync.status === 0) console.log("marathon-scan --sync-marathon: OK");
  else console.error(sync.stderr || "sync failed");
}

if (!APPLY && issues.length) {
  console.log("\nRun with --apply for safe auto-fixes (statuses only).");
}

process.exit(issues.length && !APPLY ? 1 : 0);
