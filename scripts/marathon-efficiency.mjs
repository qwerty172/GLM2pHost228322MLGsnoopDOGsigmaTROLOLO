#!/usr/bin/env node
// Marathon run efficiency: metrics, auto-fixes, recommendations.
//
// Usage:
//   node scripts/marathon-efficiency.mjs --analyze          # JSON metrics + recommendations
//   node scripts/marathon-efficiency.mjs --apply            # close draft idle PRs, update metrics file
//   node scripts/marathon-efficiency.mjs --update-last-run --task M-90 --result "..." [--commit abc]
//   node scripts/marathon-efficiency.mjs --record --outcome task_done|idle|blocked [--task M-NN]

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync, spawnSync } from "node:child_process";

const MARATHON = "MARATHON.md";
const METRICS = ".marathon-efficiency.json";
const ANALYZE = process.argv.includes("--analyze");
const APPLY = process.argv.includes("--apply");
const UPDATE_LAST = process.argv.includes("--update-last-run");
const RECORD = process.argv.includes("--record");

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : null;
}

function git(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", timeout: 30000 }).trim();
  } catch {
    return "";
  }
}

function loadMetrics() {
  if (!existsSync(METRICS)) {
    return { runs: [], updatedAt: null };
  }
  try {
    return JSON.parse(readFileSync(METRICS, "utf8"));
  } catch {
    return { runs: [], updatedAt: null };
  }
}

function saveMetrics(data) {
  data.updatedAt = new Date().toISOString();
  writeFileSync(METRICS, `${JSON.stringify(data, null, 2)}\n`);
}

function countCommits(pattern, since = "7 days ago") {
  const out = git(`git log origin/main --since="${since}" --oneline --grep="${pattern}"`);
  return out ? out.split("\n").filter(Boolean).length : 0;
}

function listIdleDraftPrs() {
  try {
    const out = execSync(
      `gh pr list --state open --search "Marathon idle in:title" --json number,title,isDraft,createdAt --limit 100`,
      { encoding: "utf8", timeout: 30000 },
    );
    const prs = JSON.parse(out || "[]");
    return prs.filter((p) => p.isDraft && /Marathon idle|marathon.*idle/i.test(p.title));
  } catch {
    return [];
  }
}

function countOpenMarathonPrs() {
  try {
    const out = execSync(
      `gh pr list --state open --search "marathon in:title" --json isDraft --limit 200`,
      { encoding: "utf8", timeout: 30000 },
    );
    const prs = JSON.parse(out || "[]");
    return {
      total: prs.length,
      draft: prs.filter((p) => p.isDraft).length,
      nonDraft: prs.filter((p) => !p.isDraft).length,
    };
  } catch {
    return { total: 0, draft: 0, nonDraft: 0 };
  }
}

function mainBranchLag() {
  const branch = git("git rev-parse --abbrev-ref HEAD");
  if (!branch || branch === "main") return { branch, ahead: 0, behind: 0 };
  const ahead = parseInt(git(`git rev-list --count origin/main..HEAD`) || "0", 10);
  const behind = parseInt(git(`git rev-list --count HEAD..origin/main`) || "0", 10);
  return { branch, ahead, behind };
}

function loadScanState() {
  const r = spawnSync("node", ["scripts/marathon-scan.mjs", "--json-state"], { encoding: "utf8", timeout: 30000 });
  if (r.status !== 0) return null;
  try {
    const s = JSON.parse(r.stdout);
    const next = s.existingRows?.find((row) => row.status === "pending");
    return {
      pendingMnn: s.pendingCount ?? 0,
      nextPending: next?.id ?? null,
      scannerEmpty: s.grouped === 0 && s.rawHits === 0,
    };
  } catch {
    return null;
  }
}

function buildAnalysis() {
  const feat7d = countCommits("feat(marathon)");
  const hash7d = countCommits("commit hash");
  const idle7d = countCommits("Marathon idle");
  const groom7d = countCommits("chore(marathon)|docs(marathon)");
  const total7d = parseInt(git('git log origin/main --since="7 days ago" --oneline -- MARATHON.md scripts/marathon')?.split("\n").filter(Boolean).length || "0", 10);
  const idlePrs = listIdleDraftPrs();
  const prStats = countOpenMarathonPrs();
  const lag = mainBranchLag();
  const scan = loadScanState();

  const hashWastePct = feat7d + hash7d > 0 ? Math.round((hash7d / (feat7d + hash7d)) * 100) : 0;
  const taskHitPct = total7d > 0 ? Math.round((feat7d / total7d) * 100) : 0;

  const recommendations = [];

  if (hash7d > 0) {
    recommendations.push({
      id: "no_hash_commits",
      severity: "high",
      msg: `${hash7d} отдельных commit-hash за 7д — используй scripts/marathon-efficiency.mjs --update-last-run в том же коммите`,
    });
  }
  if (idlePrs.length > 0) {
    recommendations.push({
      id: "ignore_draft_prs",
      severity: "info",
      ignore: true,
      msg: `${idlePrs.length} draft PR «Marathon idle» — ИГНОР (не блокируют; закрывать не обязательно)`,
    });
  }
  if (prStats.draft > 50) {
    recommendations.push({
      id: "ignore_marathon_drafts",
      severity: "info",
      ignore: true,
      msg: `${prStats.draft} draft marathon PR — ИГНОР (legacy мусор; pr_in_flight только non-draft)`,
    });
  }
  if (lag.ahead > 0 && lag.branch !== "main") {
    recommendations.push({
      id: "merge_to_main",
      severity: "high",
      msg: `Ветка ${lag.branch} опережает main на ${lag.ahead} коммитов — merge/push в main, иначе cron видит stale state`,
    });
  }
  if (prStats.nonDraft > 3) {
    recommendations.push({
      id: "too_many_prs",
      severity: "medium",
      msg: `${prStats.nonDraft} non-draft marathon PR — push в main напрямую или merge`,
    });
  }
  if (scan?.scannerEmpty && scan?.pendingMnn === 0) {
    recommendations.push({
      id: "expand_scanner",
      severity: "high",
      msg: "scanner_empty — немедленно расширить marathon-scan.mjs (не ждать idle streak)",
    });
  }
  if (taskHitPct < 30 && total7d > 20) {
    recommendations.push({
      id: "low_hit_rate",
      severity: "high",
      msg: `Hit rate ${taskHitPct}% (${feat7d} feat / ${total7d} marathon commits) — см. idle-политику и push main`,
    });
  }

  return {
    window: "7d",
    metrics: {
      featTasks: feat7d,
      hashCommits: hash7d,
      idleCommits: idle7d,
      metaCommits: groom7d,
      totalMarathonCommits: total7d,
      taskHitPct,
      hashWastePct,
      idleDraftPrs: idlePrs.length,
      openPrs: prStats,
      branchLag: lag,
      pendingMnn: scan?.pendingMnn ?? null,
      nextPending: scan?.nextPending ?? null,
      scannerEmpty: scan?.scannerEmpty ?? null,
    },
    recommendations,
    idleDraftPrs: idlePrs.map((p) => ({ number: p.number, title: p.title })),
  };
}

function updateLastRun(taskId, result) {
  let md = readFileSync(MARATHON, "utf8");
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const dateStr = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;

  md = md.replace(/(\|\s*Дата\s*\|\s*)[^|]+(\s*\|)/, `$1${dateStr} UTC$2`);
  md = md.replace(/(\|\s*Task ID\s*\|\s*)[^|]+(\s*\|)/, `$1${taskId}$2`);
  md = md.replace(/(\|\s*Результат\s*\|\s*)[^|]+(\s*\|)/, `$1${result.replace(/\|/g, "\\|")}$2`);
  // Поле Commit — источник вечного цикла «fix hash» (хэш коммита нельзя записать
  // внутрь него самого). Строку удаляем совсем; поиск по ID: git log --grep.
  md = md.replace(/\|\s*Commit\s*\|[^|]*\|\n/, "");
  writeFileSync(MARATHON, md);
  console.log(JSON.stringify({ updated: true, taskId }));
}

function applyFixes(_analysis) {
  // Draft PR не закрываем: token часто без прав, 40+ gh-вызовов = waste run.
  // Блокирует только non-draft PR (см. marathon-groom hasOpenPrForTask).
  return [];
}

function updateMarathonEfficiencySection(analysis) {
  if (!existsSync(MARATHON)) return false;
  let md = readFileSync(MARATHON, "utf8");
  const marker = "### Efficiency (auto)";
  // ВАЖНО: без timestamp внутри секции — иначе каждый run порождает diff → новый
  // коммит → та же петля мусорных коммитов, что и с «fix hash».
  const body = [
    "",
    "| Метрика | 7d |",
    "|---|---|",
    `| feat(marathon) | ${analysis.metrics.featTasks} |`,
    `| commit-hash waste | ${analysis.metrics.hashCommits} (${analysis.metrics.hashWastePct}%) |`,
    `| task hit rate | ${analysis.metrics.taskHitPct}% |`,
    `| idle draft PRs | ${analysis.metrics.idleDraftPrs} |`,
    `| pending M-NN | ${analysis.metrics.pendingMnn ?? "—"} |`,
    `| branch lag (ahead main) | ${analysis.metrics.branchLag.ahead} |`,
    "",
    analysis.recommendations.length
      ? "**Рекомендации:**\n" + analysis.recommendations.map((r) => `- \`${r.id}\`: ${r.msg}`).join("\n")
      : "**Рекомендации:** нет — pipeline OK",
    "",
  ].join("\n");
  const section = marker + "\n" + body;

  const start = md.indexOf(marker);
  let next;
  if (start >= 0) {
    const end = md.indexOf("\n---\n", start);
    const current = md.slice(start, end >= 0 ? end : md.length);
    if (current.trim() === section.trim()) return false; // метрики не изменились — не трогаем файл
    next = md.slice(0, start) + section + (end >= 0 ? md.slice(end) : "");
  } else {
    const insertAt = md.indexOf("\n---\n\n## Сейчас в очереди");
    if (insertAt < 0) return false;
    next = md.slice(0, insertAt) + "\n\n" + section + md.slice(insertAt);
  }
  writeFileSync(MARATHON, next);
  return true;
}

if (UPDATE_LAST) {
  const task = arg("task");
  const result = arg("result");
  if (!task || !result) {
    console.error("Usage: --update-last-run --task M-NN --result \"...\"");
    process.exit(1);
  }
  updateLastRun(task, result);
  process.exit(0);
}

if (RECORD) {
  const outcome = arg("outcome") ?? "unknown";
  const task = arg("task");
  const data = loadMetrics();
  data.runs.push({ at: new Date().toISOString(), outcome, task });
  if (data.runs.length > 200) data.runs = data.runs.slice(-200);
  saveMetrics(data);
  console.log(JSON.stringify({ recorded: true, outcome, task }));
  process.exit(0);
}

const analysis = buildAnalysis();

if (ANALYZE || (!APPLY && !UPDATE_LAST && !RECORD)) {
  console.log(JSON.stringify(analysis, null, 2));
}

if (APPLY) {
  const closed = applyFixes(analysis);
  updateMarathonEfficiencySection(analysis);
  const data = loadMetrics();
  data.lastApply = { at: new Date().toISOString(), closedPrs: closed, metrics: analysis.metrics };
  saveMetrics(data);
  console.log(JSON.stringify({ applied: true, closedPrs: closed, recommendations: analysis.recommendations.length }));
}
