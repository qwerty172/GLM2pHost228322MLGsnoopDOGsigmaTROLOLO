#!/usr/bin/env node
// Scan the codebase for small, self-contained issues and propose new
// Marathon maintenance tasks (IDs M-NN). Output is a markdown table the
// automation can paste into MARATHON.md under "Wave Maintenance".
//
// Usage:
//   node scripts/marathon-scan.mjs              # print candidate tasks
//   node scripts/marathon-scan.mjs --pick 1    # print one ready-to-do task (json)
//
// Categories (each candidate gets an ID M-NN, incremented from existing):
//   A. English user-facing strings in web UI (should be RU)
//   B. TODO/FIXME/XXX/HACK comments
//   C. Express routes missing from OpenAPI spec
//   D. console.log / debugger leftovers in src
//   E. New modules without a co-located test
//
// Source of truth: working tree (== main after git pull).

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { execSync } from "node:child_process";

const PICK = (() => {
  const i = process.argv.indexOf("--pick");
  return i >= 0 ? parseInt(process.argv[i + 1], 10) || 1 : 0;
})();

function rg(pattern, paths, opts = "") {
  try {
    return execSync(`rg ${opts} "${pattern}" ${paths.join(" ")} 2>/dev/null`, {
      encoding: "utf8",
    }).trim();
  } catch {
    return "";
  }
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

const candidates = [];

// --- A. English user-facing strings in shadcn/web UI ----------------------
// Only flag words inside string literals (quoted), not identifiers/imports.
const enHits = rg(
  '["\'`](Close|Open|Submit|Cancel|Save|Loading|Toggle Sidebar|Next|Previous|More pages|Search)["\'`]',
  ["artifacts/web/src/components/ui"],
  "-n"
);
for (const line of (enHits || "").split("\n")) {
  const m = line.match(/^([^:]+):(\d+):.*["'`]([^"'`]+)["'`]/);
  if (!m) continue;
  candidates.push({
    cat: "A",
    title: "RU-строка в web UI (EN→RU)",
    file: m[1],
    detail: `осталось EN: "${m[3]}"`,
  });
}

// --- B. TODO/FIXME/XXX/HACK ---------------------------------------------
const todoHits = rg("\\b(TODO|FIXME|XXX|HACK)\\b", ["artifacts", "lib"], "-n");
for (const line of (todoHits || "").split("\n")) {
  const m = line.match(/^([^:]+):(\d+):\s*(.*)$/);
  if (!m) continue;
  if (/node_modules|\/dist\//.test(m[1])) continue;
  candidates.push({
    cat: "B",
    title: "TODO/FIXME в коде",
    file: m[1],
    detail: m[3].slice(0, 80),
  });
}

// --- C. Express routes missing from OpenAPI -------------------------------
try {
  const spec = readFileSync("lib/api-spec/openapi.yaml", "utf8");
  const specPaths = new Set();
  for (const m of spec.matchAll(/^\s*\/api\/[^\s:]+/gm)) specPaths.add(m[0].trim());
  const routeFiles = walk("artifacts/api-server/src/routes").filter((f) => f.endsWith(".ts"));
  for (const f of routeFiles) {
    const txt = readFileSync(f, "utf8");
    for (const m of txt.matchAll(/router\.(get|post|put|patch|delete)\(\s*["`]([^"`]+)/g)) {
      let p = m[2].replace(/:(\w+)/g, "{$1}");
      if (!p.startsWith("/api")) p = "/api" + p;
      if (!specPaths.has(p)) {
        candidates.push({
          cat: "C",
          title: "OpenAPI gap — route без spec",
          file: f,
          detail: `${m[1].toUpperCase()} ${p}`,
        });
      }
    }
  }
} catch {}

// --- D. console.log / debugger leftovers ----------------------------------
const dbgHits = rg("\\bconsole\.(log|debug)\\b|\\bdebugger\\b", ["artifacts", "lib"], "-n");
for (const line of (dbgHits || "").split("\n")) {
  const m = line.match(/^([^:]+):(\d+):(.*)$/);
  if (!m) continue;
  if (/node_modules|\/dist\//.test(m[1])) continue;
  if (/scripts\/|\.test\.|smoke|logger\.ts/.test(m[1])) continue; // legit in scripts/tests/logger
  candidates.push({
    cat: "D",
    title: "console.log/debugger leftover",
    file: m[1],
    detail: m[3].trim().slice(0, 60),
  });
}

// --- E. host-agent renderer modules without a test -----------------------
const rendererDir = "artifacts/host-agent/src/renderer";
if (existsSync(rendererDir)) {
  const modules = readdirSync(rendererDir).filter((f) => f.endsWith(".ts") && f !== "index.ts");
  for (const mod of modules) {
    const base = mod.replace(/\.ts$/, "");
    const testCandidates = [
      `artifacts/host-agent/test/${base}.test.mjs`,
      `artifacts/host-agent/test/${base}.test.ts`,
    ];
    if (!testCandidates.some((t) => existsSync(t))) {
      candidates.push({
        cat: "E",
        title: "renderer-модуль без unit-теста",
        file: `${rendererDir}/${mod}`,
        detail: `нет ${base}.test.*`,
      });
    }
  }
}

// --- assign IDs M-NN (continue from existing in MARATHON.md) -------------
let nextId = 1;
try {
  const md = readFileSync("MARATHON.md", "utf8");
  const ids = [...md.matchAll(/\bM-(\d+)\b/g)].map((m) => parseInt(m[1], 10));
  if (ids.length) nextId = Math.max(...ids) + 1;
} catch {}
for (const c of candidates) c.id = `M-${String(nextId++).padStart(2, "0")}`;

// --- output --------------------------------------------------------------
if (PICK) {
  if (!candidates.length) {
    console.log(JSON.stringify({ found: 0 }));
  } else {
    const c = candidates[PICK - 1] || candidates[0];
    console.log(JSON.stringify({ found: candidates.length, pick: c }, null, 2));
  }
} else {
  console.log(`# Marathon scan — ${candidates.length} candidate task(s)\n`);
  console.log("| ID | Cat | Задача | Файл | Детали |");
  console.log("|----|-----|--------|------|--------|");
  for (const c of candidates) {
    console.log(`| ${c.id} | ${c.cat} | ${c.title} | \`${c.file}\` | ${c.detail.replace(/\|/g, "\\|")} |`);
  }
  console.log(`\nКатегории: A=RU-строки, B=TODO/FIXME, C=OpenAPI gap, D=debug leftover, E=нет теста.`);
}
