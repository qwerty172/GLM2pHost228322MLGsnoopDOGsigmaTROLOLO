#!/usr/bin/env node
// Гейт перед коммитом marathon-задачи: не даёт закрыть M-NN пустым,
// docs-only или красным коммитом. Источник ~1000 бесполезных runs — именно
// коммиты, где менялся только MARATHON.md/TESTLOG.md.
//
// Usage:
//   node scripts/marathon-verify.mjs --task M-NN         # проверить и запустить тесты
//   node scripts/marathon-verify.mjs --task M-NN --no-tests
//
// Exit 0 — можно коммитить. Exit 1 — причина в stdout, задачу закрывать нельзя.

import { execSync, spawnSync } from "node:child_process";

const TASK = (() => {
  const i = process.argv.indexOf("--task");
  return i >= 0 ? process.argv[i + 1] : null;
})();
const NO_TESTS = process.argv.includes("--no-tests");

const DOC_FILES = /^(MARATHON\.md|TESTLOG\.md|UX_BACKLOG\.md|HOSTING\.md|\.marathon-efficiency\.json)$/;

/** Пакеты, чьи тесты нужно прогнать, исходя из изменённых путей. */
const PACKAGE_TESTS = [
  [/^lib\/db\//, "@workspace/db"],
  [/^lib\/auth-verifier\//, "@workspace/auth-verifier"],
  [/^lib\/integrations-anthropic-ai\//, "@workspace/integrations-anthropic-ai"],
  [/^artifacts\/api-server\//, "@workspace/api-server"],
  [/^artifacts\/web\//, "@workspace/web"],
];

function changedFiles() {
  const out = execSync("git status --porcelain", { encoding: "utf8" }).trim();
  if (!out) return [];
  return out
    .split("\n")
    .map((l) => l.slice(3).trim())
    .filter(Boolean);
}

const problems = [];
const files = changedFiles();

// 1. Пустой diff — коммитить нечего.
if (!files.length) {
  problems.push("нет изменений в рабочем дереве — коммит запрещён (пустой run)");
}

// 2. Только документация — работа не сделана, статус двигать нельзя.
const codeFiles = files.filter((f) => !DOC_FILES.test(f));
if (files.length && !codeFiles.length) {
  problems.push(
    "изменены только MARATHON/TESTLOG/UX_BACKLOG — задача не выполнена, это docs-only коммит",
  );
}

// 3. Тестовые категории обязаны добавлять тест.
const touchedTest = codeFiles.some((f) => /\.test\.(ts|tsx|mjs)$/.test(f));

// 4. Прогон тестов затронутых пакетов.
const failedPackages = [];
if (!NO_TESTS && codeFiles.length) {
  const pkgs = new Set();
  for (const f of codeFiles) {
    for (const [re, pkg] of PACKAGE_TESTS) if (re.test(f)) pkgs.add(pkg);
  }
  for (const pkg of pkgs) {
    const r = spawnSync("pnpm", ["--filter", pkg, "run", "test"], {
      encoding: "utf8",
      timeout: 600000,
    });
    if (r.status !== 0) failedPackages.push(pkg);
  }
  if (failedPackages.length) {
    problems.push(`красные тесты: ${failedPackages.join(", ")} — done ставить нельзя`);
  }
}

const ok = problems.length === 0;
console.log(
  JSON.stringify(
    {
      task: TASK,
      ok,
      changedFiles: files.length,
      codeFiles: codeFiles.length,
      touchedTest,
      testedPackages: NO_TESTS ? "skipped" : "run",
      failedPackages,
      problems,
      verdict: ok
        ? "OK: можно коммитить и ставить done"
        : "STOP: задачу закрывать нельзя, см. problems",
    },
    null,
    2,
  ),
);

process.exit(ok ? 0 : 1);
