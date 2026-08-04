import { test, mock } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "host-agent-wake-scheduler-"));

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return { app: { getAppPath: () => tmpRoot } };
  }
  return load.apply(this, arguments);
};

const {
  syncWakeTasks,
  dayToWinDay,
  utcSlotToLocal,
  buildWakeTaskScript,
  parseWakeTaskNames,
} = await import("../dist/main/main/wake-scheduler.js");

test("dayToWinDay maps 0-6 to Sunday-Saturday and falls back for invalid", () => {
  assert.equal(dayToWinDay(0), "Sunday");
  assert.equal(dayToWinDay(1), "Monday");
  assert.equal(dayToWinDay(6), "Saturday");
  assert.equal(dayToWinDay(99), "Sunday");
});

test("utcSlotToLocal converts UTC slot to local day and HH:MM", () => {
  const now = new Date("2026-08-04T12:00:00.000Z");
  const local = utcSlotToLocal(1, 9 * 60, now);
  assert.equal(typeof local.day, "number");
  assert.match(local.hhmm, /^\d{2}:\d{2}$/);
});

test("parseWakeTaskNames extracts only CloudGamingWake_ tasks from schtasks CSV", () => {
  const stdout = '"CloudGamingWake_0_Monday_540","Next Run Time"\n"OtherTask"\n';
  assert.deepEqual(parseWakeTaskNames(stdout), ["CloudGamingWake_0_Monday_540"]);
  assert.deepEqual(parseWakeTaskNames(""), []);
});

test("buildWakeTaskScript includes WakeToRun trigger and escapes exe path quotes", () => {
  const now = new Date("2026-08-04T12:00:00.000Z");
  const { taskName, script } = buildWakeTaskScript(
    { day: 1, startMin: 540, endMin: 1020 },
    0,
    "C:\\Agent\\it's.exe",
    now,
  );
  assert.equal(taskName, "CloudGamingWake_0_Monday_540");
  assert.match(script, /New-ScheduledTaskSettingsSet -WakeToRun/);
  assert.match(script, /-DaysOfWeek Monday/);
  assert.match(script, /it''s\.exe/);
  assert.match(script, /-Argument '--hidden'/);
});

test("non-win32: syncWakeTasks skips schtasks and logs platform warning", async () => {
  if (process.platform === "win32") return;
  const restoreLog = mock.method(console, "log", () => {});
  const restoreError = mock.method(console, "error", () => {});
  try {
    await syncWakeTasks("scheduled", [{ day: 1, startMin: 540, endMin: 1020 }]);
    assert.ok(
      restoreLog.mock.calls.some((c) =>
        String(c.arguments[0]).includes("only implemented for Windows"),
      ),
    );
  } finally {
    restoreLog.mock.restore();
    restoreError.mock.restore();
  }
});

test("win32: syncWakeTasks clears tasks when schedule mode is not scheduled", async () => {
  if (process.platform !== "win32") return;
  const restoreLog = mock.method(console, "log", () => {});
  const restoreError = mock.method(console, "error", () => {});
  try {
    await syncWakeTasks("always", [{ day: 1, startMin: 540, endMin: 1020 }]);
    assert.ok(
      restoreLog.mock.calls.some((c) =>
        String(c.arguments[0]).includes("No active schedule"),
      ),
    );
  } finally {
    restoreLog.mock.restore();
    restoreError.mock.restore();
  }
});
