#!/usr/bin/env node
// Замер покрытия по пакетам → .marathon-coverage.json.
// Питает категорию X в marathon-scan.mjs: «поднять покрытие файла до порога».
//
// Очередь на этой категории не иссякает: когда все файлы дотянуты до текущего
// порога, ступень поднимается (50 → 65 → 80 → 90) и появляется новый слой работы.
//
// Usage:
//   node scripts/marathon-coverage.mjs            # замерить и записать отчёт
//   node scripts/marathon-coverage.mjs --print    # показать файлы ниже порога

import { writeFileSync, readFileSync, existsSync, mkdtempSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPORT = ".marathon-coverage.json";
const PRINT = process.argv.includes("--print");
const TIERS = [50, 65, 80, 90];

/** Пакеты на node:test — только их умеет мерить встроенный репортёр. */
const PACKAGES = [
  { dir: "lib/db", loader: ["--import", "tsx"], tests: "test/*.test.ts" },
  { dir: "lib/auth-verifier", loader: ["--import", "tsx"], tests: "test/*.test.ts" },
  {
    dir: "lib/integrations-anthropic-ai",
    loader: ["--import", "tsx"],
    tests: "test/*.test.ts",
  },
  { dir: "artifacts/web", loader: ["--import", "tsx"], tests: "test/*.test.mjs" },
];

/** lcov → { файл: { lines, covered, pct } } */
function parseLcov(text, pkgDir) {
  const files = {};
  let current = null;
  for (const line of text.split("\n")) {
    if (line.startsWith("SF:")) {
      current = { path: `${pkgDir}/${line.slice(3).trim()}`, total: 0, hit: 0 };
    } else if (line.startsWith("DA:") && current) {
      const [, count] = line.slice(3).split(",");
      current.total += 1;
      if (parseInt(count, 10) > 0) current.hit += 1;
    } else if (line === "end_of_record" && current) {
      if (!/\.test\.|\/test\//.test(current.path) && current.total >= 15) {
        files[current.path] = {
          lines: current.total,
          covered: current.hit,
          pct: Math.round((current.hit / current.total) * 100),
        };
      }
      current = null;
    }
  }
  return files;
}

function measure(pkg) {
  if (!existsSync(`${pkg.dir}/node_modules`)) {
    spawnSync("pnpm", ["--filter", `./${pkg.dir}`, "install"], { timeout: 600000 });
  }
  const out = join(mkdtempSync(join(tmpdir(), "marathon-cov-")), "cov.info");
  // shell: true — в путях тестов есть glob, его должен раскрыть шелл.
  // Пути обязаны идти ПОСЛЕ флагов, иначе node примет флаги за имена файлов.
  const r = spawnSync(
    [
      "node",
      ...pkg.loader,
      "--test",
      "--experimental-test-coverage",
      "--test-reporter=lcov",
      `--test-reporter-destination=${out}`,
      pkg.tests,
    ].join(" "),
    { cwd: pkg.dir, encoding: "utf8", timeout: 600000, shell: true },
  );
  if (!existsSync(out)) return { files: {}, error: (r.stderr || "").slice(0, 200) };
  return { files: parseLcov(readFileSync(out, "utf8"), pkg.dir) };
}

const previous = existsSync(REPORT) ? JSON.parse(readFileSync(REPORT, "utf8")) : {};
const allFiles = {};
const errors = {};
for (const pkg of PACKAGES) {
  const { files, error } = measure(pkg);
  Object.assign(allFiles, files);
  if (error) errors[pkg.dir] = error;
}

// Ступень поднимается, только когда под текущей не осталось ни одного файла.
const measured = Object.values(allFiles);
let tier = previous.tier ?? TIERS[0];
if (measured.length) {
  while (tier < TIERS[TIERS.length - 1] && !measured.some((f) => f.pct < tier)) {
    tier = TIERS[TIERS.indexOf(tier) + 1];
  }
}

const below = Object.entries(allFiles)
  .filter(([, v]) => v.pct < tier)
  .sort((a, b) => a[1].pct - b[1].pct);

const report = {
  generatedAt: new Date().toISOString(),
  tier,
  tiers: TIERS,
  measuredFiles: measured.length,
  belowTier: below.length,
  files: allFiles,
  errors,
};
writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);

if (PRINT) {
  console.log(`Ступень покрытия: ${tier}% — ниже неё ${below.length} файл(ов)\n`);
  for (const [f, v] of below.slice(0, 40)) {
    console.log(`${String(v.pct).padStart(3)}%  ${f}  (${v.covered}/${v.lines} строк)`);
  }
} else {
  console.log(
    JSON.stringify(
      { tier, measuredFiles: measured.length, belowTier: below.length, errors },
      null,
      2,
    ),
  );
}
