#!/usr/bin/env node
// Scan the codebase for small, self-contained issues and propose new
// Marathon maintenance tasks (IDs M-NN). Output is a markdown table the
// automation can paste into MARATHON.md under "Wave Maintenance".
//
// Usage:
//   node scripts/marathon-scan.mjs              # print grouped candidate tasks
//   node scripts/marathon-scan.mjs --next       # pick first pending (json)
//   node scripts/marathon-scan.mjs --sync-marathon  # seed MARATHON.md table
//
// Categories (grouped before ID assignment):
//   A. English user-facing strings in web UI (should be RU)
//   B. TODO/FIXME/XXX/HACK comments
//   C. Express routes missing from OpenAPI spec (grouped by route file)
//   D. console.log / debugger leftovers in src
//   E. host-agent renderer modules without a co-located test (grouped)
//   F. raw fetch() in web (should use codegen hooks; grouped by file)
//   G. HOSTING.md backlog items (H-NN with status backlog/improvement)
//   H. api-server lib/*.ts without co-located test (grouped)
//   I. eslint-disable / @ts-ignore leftovers (grouped by file)
//   J. `as any` in artifacts (grouped by file, skip generated)
//
// Source of truth: working tree (== main after git pull).

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";

const MARATHON = "MARATHON.md";
const PICK = (() => {
  const i = process.argv.indexOf("--pick");
  return i >= 0 ? parseInt(process.argv[i + 1], 10) || 1 : 0;
})();
const NEXT = process.argv.includes("--next");
const SYNC = process.argv.includes("--sync-marathon");
const JSON_STATE = process.argv.includes("--json-state");

function rg(pattern, paths, extraArgs = []) {
  const r = spawnSync("rg", [...extraArgs, "-e", pattern, ...paths], { encoding: "utf8" });
  if (r.error) return "";
  if (r.status !== 0 && r.status !== 1) return "";
  return (r.stdout || "").trim();
}

function walk(dir, acc = [], skip = /node_modules|\/dist\/|\/release\/|\.git\//) {
  for (const e of readdirSync(dir)) {
    const p = `${dir}/${e}`;
    const s = statSync(p);
    if (s.isDirectory()) {
      if (skip.test(p)) continue;
      walk(p, acc, skip);
    } else {
      acc.push(p);
    }
  }
  return acc;
}

function normalizeApiPath(p) {
  let bare = p.replace(/:(\w+)/g, "{$1}");
  if (bare.startsWith("/api/")) bare = bare.slice(4);
  else if (bare === "/api") bare = "/";
  return bare;
}

function shortRouteFile(file) {
  return file.replace(/^artifacts\/api-server\/src\/routes\//, "routes/");
}

const raw = [];

// --- A. English user-facing strings in shadcn/web UI ----------------------
const enHits = rg(
  '["\'`](Close|Open|Submit|Cancel|Save|Loading|Toggle Sidebar|Next|Previous|More pages|Search)["\'`]',
  ["artifacts/web/src/components/ui"],
  ["-n"],
);
for (const line of (enHits || "").split("\n")) {
  const m = line.match(/^([^:]+):(\d+):.*["'`]([^"'`]+)["'`]/);
  if (!m) continue;
  raw.push({
    cat: "A",
    groupKey: `a:${m[1]}`,
    title: "RU-строка в web UI (EN→RU)",
    file: m[1],
    detail: `осталось EN: "${m[3]}"`,
    items: [m[3]],
  });
}

// --- B. TODO/FIXME/XXX/HACK ---------------------------------------------
const todoHits = rg("\\b(TODO|FIXME|XXX|HACK)\\b", ["artifacts", "lib"], ["-n"]);
for (const line of (todoHits || "").split("\n")) {
  const m = line.match(/^([^:]+):(\d+):\s*(.*)$/);
  if (!m) continue;
  if (/node_modules|\/dist\/|\/public\/games\//.test(m[1])) continue;
  raw.push({
    cat: "B",
    groupKey: `b:${m[1]}`,
    title: "TODO/FIXME в коде",
    file: m[1],
    detail: m[3].slice(0, 80),
    items: [m[3].slice(0, 80)],
  });
}

// --- C. Express routes missing from OpenAPI (group by route file) ---------
try {
  const spec = readFileSync("lib/api-spec/openapi.yaml", "utf8");
  const specPaths = new Set();
  for (const m of spec.matchAll(/^\s*\/[^\s:#]+/gm)) specPaths.add(normalizeApiPath(m[0].trim()));
  const routeFiles = walk("artifacts/api-server/src/routes").filter((f) => f.endsWith(".ts"));
  const byFile = new Map();
  for (const f of routeFiles) {
    const txt = readFileSync(f, "utf8");
    for (const m of txt.matchAll(/router\.(get|post|put|patch|delete)\(\s*["`]([^"`]+)/g)) {
      const p = normalizeApiPath(m[2]);
      if (!specPaths.has(p)) {
        const route = `${m[1].toUpperCase()} /api${p}`;
        if (!byFile.has(f)) byFile.set(f, []);
        byFile.get(f).push(route);
      }
    }
  }
  for (const [f, routes] of byFile) {
    raw.push({
      cat: "C",
      groupKey: `c:${f}`,
      title: `OpenAPI gap: ${shortRouteFile(f)} (${routes.length} route${routes.length > 1 ? "s" : ""})`,
      file: f,
      detail: routes.slice(0, 3).join("; ") + (routes.length > 3 ? `; +${routes.length - 3} more` : ""),
      items: routes,
    });
  }
} catch {}

// --- D. console.log / debugger leftovers ----------------------------------
const dbgHits = rg("\\bconsole\\.(log|debug)\\b|\\bdebugger\\b", ["artifacts", "lib"], ["-n"]);
for (const line of (dbgHits || "").split("\n")) {
  const m = line.match(/^([^:]+):(\d+):(.*)$/);
  if (!m) continue;
  if (/node_modules|\/dist\/|\/public\/games\//.test(m[1])) continue;
  if (/scripts\/|\.test\.|smoke|logger\.ts/.test(m[1])) continue;
  const snippet = m[3].trim();
  if (/isDev\s*\)\s*console\.(log|debug)/.test(snippet) || /if\s*\(\s*isDev/.test(snippet)) continue;
  raw.push({
    cat: "D",
    groupKey: `d:${m[1]}`,
    title: "console.log/debugger leftover",
    file: m[1],
    detail: snippet.slice(0, 60),
    items: [snippet.slice(0, 60)],
  });
}

// --- E. host-agent renderer modules without a test (one grouped task) -----
const rendererDir = "artifacts/host-agent/src/renderer";
const rendererMissing = [];
if (existsSync(rendererDir)) {
  const modules = readdirSync(rendererDir).filter((f) => f.endsWith(".ts") && f !== "index.ts" && !f.endsWith(".d.ts"));
  for (const mod of modules) {
    const base = mod.replace(/\.ts$/, "");
    const testCandidates = [
      `artifacts/host-agent/test/${base}.test.mjs`,
      `artifacts/host-agent/test/${base}.test.ts`,
    ];
    if (!testCandidates.some((t) => existsSync(t))) rendererMissing.push(mod);
  }
}
if (rendererMissing.length) {
  raw.push({
    cat: "E",
    groupKey: "e:renderer",
    title: `host-agent renderer: unit-тесты (${rendererMissing.length} модулей)`,
    file: `${rendererDir}/*.ts`,
    detail: rendererMissing.slice(0, 4).join(", ") + (rendererMissing.length > 4 ? `, +${rendererMissing.length - 4}` : ""),
    items: rendererMissing,
  });
}

// --- F. raw fetch() in web (migrate to codegen hooks) ---------------------
const FETCH_SKIP = /agent-local\.ts$/;
const fetchHits = rg("\\bfetch\\(", ["artifacts/web/src"], ["-n", "--glob", "!**/*.test.*"]);
const fetchByFile = new Map();
for (const line of (fetchHits || "").split("\n")) {
  const m = line.match(/^([^:]+):(\d+):(.*)$/);
  if (!m) continue;
  if (FETCH_SKIP.test(m[1])) continue;
  if (!fetchByFile.has(m[1])) fetchByFile.set(m[1], 0);
  fetchByFile.set(m[1], fetchByFile.get(m[1]) + 1);
}
for (const [f, count] of fetchByFile) {
  const short = f.replace(/^artifacts\/web\/src\//, "");
  raw.push({
    cat: "F",
    groupKey: `f:${f}`,
    title: `web: raw fetch → codegen (${count} call${count > 1 ? "s" : ""})`,
    file: f,
    detail: short,
    items: [short],
  });
}

// --- G. HOSTING.md backlog (H-NN) -----------------------------------------
try {
  const hostingMd = readFileSync("HOSTING.md", "utf8");
  for (const m of hostingMd.matchAll(/\|\s*(H-\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|\n]+?)\s*\|/g)) {
    const id = m[1];
    const problem = m[2].trim();
    const status = m[3].trim();
    if (/fixed/i.test(status)) continue;
    raw.push({
      cat: "G",
      groupKey: `g:${id}`,
      title: `HOSTING ${id}: ${problem.slice(0, 55)}`,
      file: "HOSTING.md",
      detail: status.slice(0, 80),
      items: [id],
    });
  }
} catch {}

// --- H. api-server lib/*.ts without co-located test (grouped) -------------
const libDir = "artifacts/api-server/src/lib";
const libMissing = [];
if (existsSync(libDir)) {
  const libModules = readdirSync(libDir).filter(
    (f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && !f.endsWith(".d.ts"),
  );
  for (const mod of libModules) {
    const base = mod.replace(/\.ts$/, "");
    const testCandidates = [
      `${libDir}/${base}.test.ts`,
      `artifacts/api-server/src/__tests__/${base}.test.ts`,
    ];
    if (!testCandidates.some((t) => existsSync(t))) libMissing.push(mod);
  }
}
if (libMissing.length) {
  raw.push({
    cat: "H",
    groupKey: "h:api-lib",
    title: `api-server lib: unit-тесты (${libMissing.length} модулей)`,
    file: `${libDir}/*.ts`,
    detail: libMissing.slice(0, 4).join(", ") + (libMissing.length > 4 ? `, +${libMissing.length - 4}` : ""),
    items: libMissing,
  });
}

// --- I. eslint-disable / @ts-ignore leftovers -----------------------------
const lintHits = rg("@ts-ignore|@ts-expect-error|eslint-disable", ["artifacts", "lib"], [
  "-n",
  "--glob",
  "!**/*.test.*",
  "--glob",
  "!node_modules/**",
]);
const lintByFile = new Map();
for (const line of (lintHits || "").split("\n")) {
  const m = line.match(/^([^:]+):(\d+):(.*)$/);
  if (!m) continue;
  if (/node_modules|\/dist\/|scripts\//.test(m[1])) continue;
  if (!lintByFile.has(m[1])) lintByFile.set(m[1], []);
  lintByFile.get(m[1]).push(m[3].trim().slice(0, 60));
}
for (const [f, snippets] of lintByFile) {
  raw.push({
    cat: "I",
    groupKey: `i:${f}`,
    title: `eslint/ts suppressions (${snippets.length})`,
    file: f,
    detail: snippets[0]?.slice(0, 60) ?? f,
    items: snippets,
  });
}

// --- J. `as any` in artifacts (group by file, skip generated) --------------
const ANY_SKIP = /lib\/api-client-react|lib\/api-zod|\/dist\/|node_modules|\/public\/games\//;
const anyHits = rg("\\bas any\\b", ["artifacts"], [
  "-n",
  "--glob",
  "!**/*.test.*",
  "--glob",
  "!**/generated/**",
]);
const anyByFile = new Map();
for (const line of (anyHits || "").split("\n")) {
  const m = line.match(/^([^:]+):(\d+):(.*)$/);
  if (!m) continue;
  if (ANY_SKIP.test(m[1])) continue;
  if (!anyByFile.has(m[1])) anyByFile.set(m[1], 0);
  anyByFile.set(m[1], anyByFile.get(m[1]) + 1);
}
for (const [f, count] of anyByFile) {
  raw.push({
    cat: "J",
    groupKey: `j:${f}`,
    title: `убрать as any (${count})`,
    file: f,
    detail: f.replace(/^artifacts\//, ""),
    items: [String(count)],
  });
}

// --- group raw hits (merge same groupKey) --------------------------------
const grouped = new Map();
for (const c of raw) {
  const g = grouped.get(c.groupKey);
  if (!g) {
    grouped.set(c.groupKey, { ...c, items: [...(c.items || [])] });
  } else {
    g.items.push(...(c.items || []));
    if (c.detail && !g.detail.includes(c.detail)) g.detail = `${g.detail}; ${c.detail}`.slice(0, 120);
  }
}
const candidates = [...grouped.values()];

// --- read MARATHON.md for skip + existing M-NN rows -----------------------
let marathonMd = "";
try {
  marathonMd = readFileSync(MARATHON, "utf8");
} catch {}

const doneOrActiveKeys = new Set();
const existingRows = [];
for (const line of marathonMd.split("\n")) {
  if (!/^\|\s*M-\d+/.test(line)) continue;
  const parts = line.split("|").map((s) => s.trim());
  if (parts.length < 6) continue;
  const id = parts[1];
  const cat = parts[2];
  const title = parts[3];
  const fileCol = parts[4] ?? "";
  const file = fileCol.replace(/`/g, "").replace(/\s*key:[^\s]+/, "").trim();
  let groupKey = parts[5] ?? "";
  let status = parts[6] ?? "";
  let owner = parts[7] ?? "agent";
  // legacy 6-col: Key embedded in file cell
  if (!/^[a-z]:/.test(groupKey)) {
    const km = fileCol.match(/key:([a-z]:[^\s|]+)/);
    groupKey = km ? km[1] : `legacy:${file}`;
    status = parts[5] ?? "";
    owner = parts[6] ?? "agent";
  }
  if (!/^(pending|in_progress|done|blocked|skipped)$/i.test(status)) continue;
  status = status.toLowerCase();
  existingRows.push({ id, cat, title, status, line, groupKey, file, owner });
  if (status === "done" || status === "in_progress") doneOrActiveKeys.add(groupKey);
}

const CAT_ORDER = { B: 0, C: 1, A: 2, G: 3, F: 4, E: 5, H: 6, D: 7, I: 8, J: 9 };
const filtered = candidates
  .filter((c) => !doneOrActiveKeys.has(c.groupKey))
  .sort((a, b) => (CAT_ORDER[a.cat] ?? 9) - (CAT_ORDER[b.cat] ?? 9));

let nextId = 1;
const ids = [...marathonMd.matchAll(/\bM-(\d+)\b/g)].map((m) => parseInt(m[1], 10));
if (ids.length) nextId = Math.max(...ids) + 1;

function assignId(c, existingPending) {
  const prev = existingPending.find((r) => r.groupKey === c.groupKey);
  if (prev) return prev.id;
  const id = `M-${String(nextId++).padStart(2, "0")}`;
  return id;
}

// IDs for display output only (not sync)
for (const c of filtered) {
  c.id = assignId(c, existingRows.filter((r) => r.status === "pending"));
}

function formatRow(c, status = "pending") {
  const fileCell = c.file.includes("renderer")
    ? "`renderer/*.ts`"
    : `\`${shortRouteFile(c.file)}\``;
  const detail = (c.detail || "").replace(/\|/g, "\\|");
  return `| ${c.id} | ${c.cat} | ${c.title} | ${fileCell} | ${c.groupKey} | ${status} | agent |`;
}

// --- --json-state: machine-readable state for marathon-groom.mjs -----------
if (JSON_STATE) {
  const scannerKeys = new Set(candidates.map((c) => c.groupKey));
  console.log(
    JSON.stringify({
      rawHits: raw.length,
      grouped: candidates.length,
      candidates: candidates.map((c) => ({ groupKey: c.groupKey, cat: c.cat, title: c.title, file: c.file })),
      existingRows,
      pendingCount: existingRows.filter((r) => r.status === "pending").length,
      scannerKeys: [...scannerKeys],
    }),
  );
  process.exit(0);
}

// --- --sync-marathon: rewrite Wave Maintenance table ----------------------
if (SYNC) {
  const keptNonPending = existingRows.filter((r) => r.status !== "pending");
  const pendingFromScan = candidates
    .filter((c) => !doneOrActiveKeys.has(c.groupKey))
    .sort((a, b) => (CAT_ORDER[a.cat] ?? 9) - (CAT_ORDER[b.cat] ?? 9));
  nextId = ids.length ? Math.max(...ids) + 1 : 1;
  const pendingRows = pendingFromScan.map((c) => {
    const id = assignId(c, existingRows.filter((r) => r.status === "pending"));
    c.id = id;
    return formatRow(c, "pending");
  });
  const allRows = [...keptNonPending.map((r) => r.line), ...pendingRows];
  if (!allRows.length) allRows.push("| — | — | *(сканер пуст — Marathon idle)* | — | — | — | — |");

  const table = [
    "| ID | Cat | Задача | Файл | Key | Status | Owner |",
    "|----|-----|--------|------|-----|--------|-------|",
    ...allRows,
  ].join("\n");

  const marker = "### Очередь M-NN";
  const start = marathonMd.indexOf(marker);
  if (start < 0) {
    console.error("MARATHON.md: section '### Очередь M-NN' not found");
    process.exit(1);
  }
  const afterMarker = marathonMd.indexOf("\n", start) + 1;
  const end = marathonMd.indexOf("\n\n>", afterMarker);
  const endAlt = marathonMd.indexOf("\n---\n", afterMarker);
  const tableEnd = end > 0 && (endAlt < 0 || end < endAlt) ? end : endAlt;
  const out =
    marathonMd.slice(0, afterMarker) +
    "\n" +
    table +
    "\n" +
    marathonMd.slice(tableEnd > 0 ? tableEnd : marathonMd.length);
  writeFileSync(MARATHON, out);

  console.log(
    JSON.stringify(
      {
        synced: true,
        rawHits: raw.length,
        grouped: candidates.length,
        newPending: pendingRows.length,
        totalPending: pendingRows.length,
        tasks: pendingFromScan.map((c) => ({ id: c.id, cat: c.cat, title: c.title })),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

// --- output --------------------------------------------------------------
if (NEXT || PICK) {
  const queuePending = existingRows.filter((r) => r.status === "pending");
  const firstQueued = queuePending[0];
  if (firstQueued) {
    const fromScan = candidates.find((c) => c.groupKey === firstQueued.groupKey);
    const pick = {
      id: firstQueued.id,
      cat: firstQueued.cat,
      title: firstQueued.title,
      file: fromScan?.file ?? firstQueued.file,
      groupKey: firstQueued.groupKey,
      detail: fromScan?.detail ?? firstQueued.title,
      items: fromScan?.items ?? [],
      source: "marathon-queue",
    };
    console.log(
      JSON.stringify(
        {
          found: queuePending.length,
          raw: raw.length,
          grouped: candidates.length,
          idle: false,
          pick,
        },
        null,
        2,
      ),
    );
  } else if (!filtered.length) {
    console.log(JSON.stringify({ found: 0, raw: raw.length, grouped: candidates.length, skipped: candidates.length - filtered.length, idle: true }));
  } else {
    const c = PICK ? filtered[PICK - 1] || filtered[0] : filtered[0];
    console.log(
      JSON.stringify(
        { found: filtered.length, raw: raw.length, grouped: candidates.length, skipped: candidates.length - filtered.length, pick: c, source: "scanner" },
        null,
        2,
      ),
    );
  }
} else {
  console.log(`# Marathon scan — ${filtered.length} grouped task(s) from ${raw.length} raw hit(s)\n`);
  console.log("| ID | Cat | Задача | Файл | Детали |");
  console.log("|----|-----|--------|------|--------|");
  for (const c of filtered) {
    console.log(`| ${c.id} | ${c.cat} | ${c.title} | \`${c.file}\` | ${(c.detail || "").replace(/\|/g, "\\|")} |`);
  }
  console.log(
    `\nКатегории: A=RU-строки, B=TODO/FIXME, C=OpenAPI gap, D=debug, E=renderer-тесты, F=raw fetch, G=HOSTING backlog, H=api-lib тесты, I=eslint suppressions, J=as any.`,
  );
  console.log(`Синхронизация: node scripts/marathon-scan.mjs --sync-marathon`);
}
