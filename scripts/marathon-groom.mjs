#!/usr/bin/env node
// Marathon meta-grooming: detect workflow drift, phantom tasks, stale state.
// Safe auto-fixes (--apply) only touch MARATHON.md statuses — not product code.
//
// Usage:
//   node scripts/marathon-groom.mjs           # report
//   node scripts/marathon-groom.mjs --apply   # fix MARATHON.md + optional scan sync hint
//   node scripts/marathon-groom.mjs --should-run [--mark-skipped]  # cron gate; --mark-skipped updates Result only (Date preserved)

import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { execSync } from "node:child_process";

const MARATHON = "MARATHON.md";
const APPLY = process.argv.includes("--apply");
const SHOULD_RUN = process.argv.includes("--should-run");
const MARK_SKIPPED = process.argv.includes("--mark-skipped");
const STALE_HOURS = 24;
const IDLE_EXPAND_AFTER = 3; // consecutive idle runs → expand scanner
const IDLE_COMMIT_MIN_MIN = 30; // don't commit Last run more often than this

function parseLastRun() {
  const md = readFileSync(MARATHON, "utf8");
  const dateM = md.match(/\|\s*Дата\s*\|\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s*UTC\s*\|/);
  const resultM = md.match(/\|\s*Результат\s*\|\s*([^|]+)\s*\|/);
  return {
    ms: dateM ? Date.parse(`${dateM[1].replace(" ", "T")}:00Z`) : 0,
    result: resultM ? resultM[1].trim() : "",
  };
}

/** Обновить только Result в Last run — Date НЕ трогать. */
function markLastRunSkipped(reason) {
  let md = readFileSync(MARATHON, "utf8");
  const skipped = `skipped (${reason})`;
  const resultM = md.match(/\|\s*Результат\s*\|\s*([^|]+)\s*\|/);
  if (resultM && resultM[1].trim() === skipped) return false;
  md = md.replace(
    /(\|\s*Результат\s*\|\s*)([^|]+)(\s*\|)/,
    `$1${skipped}$3`,
  );
  writeFileSync(MARATHON, md);
  return true;
}

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

function nextPendingId(rows) {
  const row = rows.find((r) => r.status === "pending");
  return row?.id ?? null;
}

/** Open non-draft PR с тем же M-NN в title — другой run уже в работе. DRAFT не блокирует. */
function hasOpenPrForTask(taskId) {
  if (!taskId) return false;
  try {
    const out = execSync(
      `gh pr list --state open --search "${taskId} in:title" --json isDraft --jq '[.[] | select(.isDraft==false)] | length'`,
      { encoding: "utf8", timeout: 20000 },
    ).trim();
    return parseInt(out, 10) > 0;
  } catch {
    return false;
  }
}

function countRecentIdleRuns() {
  try {
    // Берём последние 10 коммитов MARATHON.md и считаем подряд идущие idle
    const out = execSync(
      'git log --oneline -10 --format="%s" -- MARATHON.md',
      { encoding: "utf8" },
    ).trim();
    if (!out) return 0;
    const lines = out.split("\n");
    let streak = 0;
    for (const line of lines) {
      const isIdle = /Marathon idle|idle —|idle:|idle \|/.test(line);
      const isReal = /M-\d+|расширить|groom|reconcile|sync/i.test(line) && !isIdle;
      if (isReal) break;
      if (isIdle) streak++;
      else break;
    }
    return streak;
  } catch {
    return 0;
  }
}

function isScannerEmpty(state) {
  return state.grouped === 0 && state.rawHits === 0;
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

if (SHOULD_RUN) {
  const lastRun = parseLastRun();
  const hasInProgress = state.existingRows.some((r) => r.status === "in_progress");
  const pendingMnn = state.existingRows.filter((r) => r.status === "pending").length;
  const nextId = nextPendingId(state.existingRows);
  const prInFlight = hasOpenPrForTask(nextId);
  const ageMs = lastRun.ms ? Date.now() - lastRun.ms : null;
  // Cron каждую минуту: НЕ блокировать по интервалу — каждый run берёт следующую M-NN.
  // Skip только если открытый PR на next M-NN или другой run уже in_progress.
  const idleStreak = countRecentIdleRuns();
  const scannerEmpty = isScannerEmpty(state);
  const needsExpand = pendingMnn === 0 && scannerEmpty;
  const expandNow = needsExpand && idleStreak >= IDLE_EXPAND_AFTER;
  const skip = prInFlight || hasInProgress;
  const payload = {
    shouldRun: !skip,
    reason: skip
      ? prInFlight
        ? "pr_in_flight"
        : "in_progress_active"
      : expandNow
        ? "scanner_empty_expand"
        : needsExpand
          ? "scanner_empty"
          : "ok",
    ageMin: ageMs != null ? Math.round(ageMs / 60000) : null,
    pendingMnn,
    nextPending: nextId,
    prInFlight,
    hasInProgress,
    idleStreak,
    scannerEmpty,
    agentInstruction: skip
      ? `STOP: ${prInFlight ? "pr_in_flight" : "in_progress_active"} — commit MARATHON if needed, exit`
      : nextId
        ? `EXECUTE ${nextId} only: OpenAPI/codegen or code per marathon-scan --next. NO read MARATHON, NO list-cloud-agents, NO prompt meta, NO automation_memory`
        : expandNow
          ? `EXPAND SCANNER: grouped=0 after ${idleStreak} idle runs. Add category to marathon-scan.mjs (HOSTING backlog, raw fetch, missing tests, etc.) → --sync-marathon → commit. NO empty Last-run commit.`
          : needsExpand
            ? `Marathon idle (${idleStreak}/${IDLE_EXPAND_AFTER} toward expand) — NO commit unless meta changed, exit`
            : "Marathon idle — update Last run only if ageMin>30, exit",
  };
  console.log(JSON.stringify(payload));
  if (skip && MARK_SKIPPED) {
    const updated = markLastRunSkipped(payload.reason);
    if (updated) console.log(`Last run → skipped (${payload.reason}) [Date preserved]`);
  }
  process.exit(skip ? 2 : 0);
}

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
