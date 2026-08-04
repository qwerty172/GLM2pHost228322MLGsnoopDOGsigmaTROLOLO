import { test, mock } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "host-agent-logger-"));

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return { app: { getAppPath: () => tmpRoot } };
  }
  return load.apply(this, arguments);
};

async function importLogger() {
  const url = new URL("../dist/main/main/logger.js", import.meta.url);
  url.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  return import(url.href);
}

test("log writes info line to agent.log and console.log", async () => {
  const { log } = await importLogger();
  const logPath = path.join(tmpRoot, "logs", "agent.log");
  const restoreLog = mock.method(console, "log", () => {});
  const restoreError = mock.method(console, "error", () => {});
  try {
    log("info", "hello world");
    assert.ok(fs.existsSync(logPath));
    const content = fs.readFileSync(logPath, "utf8");
    assert.match(content, /\[info\] hello world/);
    assert.equal(restoreLog.mock.calls.length, 1);
    assert.match(restoreLog.mock.calls[0].arguments[0], /\[info\] hello world/);
    assert.equal(restoreError.mock.calls.length, 0);
  } finally {
    restoreLog.mock.restore();
    restoreError.mock.restore();
  }
});

test("log uses console.error for error level", async () => {
  const { log } = await importLogger();
  const restoreLog = mock.method(console, "log", () => {});
  const restoreError = mock.method(console, "error", () => {});
  try {
    log("error", "boom");
    assert.equal(restoreError.mock.calls.length, 1);
    assert.match(restoreError.mock.calls[0].arguments[0], /\[error\] boom/);
    assert.equal(restoreLog.mock.calls.length, 0);
  } finally {
    restoreLog.mock.restore();
    restoreError.mock.restore();
  }
});

test("log appends warn lines to agent.log", async () => {
  const { log } = await importLogger();
  const logPath = path.join(tmpRoot, "logs", "agent.log");
  const restoreLog = mock.method(console, "log", () => {});
  const restoreError = mock.method(console, "error", () => {});
  try {
    log("warn", "first");
    log("warn", "second");
    const lines = fs.readFileSync(logPath, "utf8").trim().split("\n");
    assert.ok(lines.length >= 2);
    assert.match(lines[lines.length - 2], /\[warn\] first/);
    assert.match(lines[lines.length - 1], /\[warn\] second/);
    assert.equal(restoreLog.mock.calls.length, 2);
  } finally {
    restoreLog.mock.restore();
    restoreError.mock.restore();
  }
});
