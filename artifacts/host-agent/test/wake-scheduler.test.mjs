import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { promisify } from "node:util";

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "host-agent-wake-scheduler-"));

/** @type {Array<{ file: string; args: string[] }>} */
let execFileCalls = [];
let execFileBehavior = {
  queryStdout: `"CloudGamingWake_0_Monday_540","Ready"\n"OtherTask","Ready"\n`,
  failQuery: false,
  failDeleteNames: new Set(),
  failPowershellIndices: new Set(),
};

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return { app: { getAppPath: () => tmpRoot } };
  }
  if (request === "node:child_process") {
    const orig = load.apply(this, arguments);

    function mockExecFile(file, args, optionsOrCb, maybeCb) {
      let options = {};
      let callback = maybeCb;
      if (typeof optionsOrCb === "function") {
        callback = optionsOrCb;
      } else if (typeof maybeCb === "function") {
        options = optionsOrCb ?? {};
        callback = maybeCb;
      } else {
        throw new Error("mockExecFile: callback required");
      }
      execFileCalls.push({ file, args: [...args] });

      const finish = (err, stdout = "", stderr = "") => {
        process.nextTick(() => callback(err, stdout, stderr));
      };

      if (file === "schtasks" && args[0] === "/Query") {
        if (execFileBehavior.failQuery) return finish(new Error("query failed"));
        return finish(null, execFileBehavior.queryStdout, "");
      }
      if (file === "schtasks" && args[0] === "/Delete") {
        const name = args[args.indexOf("/TN") + 1];
        if (execFileBehavior.failDeleteNames.has(name)) {
          return finish(new Error(`delete failed: ${name}`));
        }
        return finish(null, "", "");
      }
      if (file === "powershell") {
        const psIndex = execFileCalls.filter((c) => c.file === "powershell").length - 1;
        if (execFileBehavior.failPowershellIndices.has(psIndex)) {
          return finish(new Error("powershell failed"));
        }
        return finish(null, "", "");
      }
      return finish(new Error(`unexpected execFile: ${file} ${args.join(" ")}`));
    }

    mockExecFile[promisify.custom] = (file, args, options) =>
      new Promise((resolve, reject) => {
        mockExecFile(file, args, options, (err, stdout, stderr) => {
          if (err) reject(err);
          else resolve({ stdout, stderr });
        });
      });

    return { ...orig, execFile: mockExecFile };
  }
  return load.apply(this, arguments);
};

async function importWakeScheduler() {
  const url = new URL("../dist/main/main/wake-scheduler.js", import.meta.url);
  url.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  return import(url.href);
}

function resetExecMock() {
  execFileCalls = [];
  execFileBehavior = {
    queryStdout: `"CloudGamingWake_0_Monday_540","Ready"\n"OtherTask","Ready"\n`,
    failQuery: false,
    failDeleteNames: new Set(),
    failPowershellIndices: new Set(),
  };
}

function withWin32(fn) {
  return async () => {
    const origPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "win32" });
    try {
      await fn();
    } finally {
      Object.defineProperty(process, "platform", { value: origPlatform });
    }
  };
}

function schtasksCalls(kind) {
  return execFileCalls.filter((c) => c.file === "schtasks" && c.args[0] === kind);
}

function powershellCalls() {
  return execFileCalls.filter((c) => c.file === "powershell");
}

test("syncWakeTasks no-ops on non-win32", async () => {
  resetExecMock();
  if (process.platform === "win32") return;
  const { syncWakeTasks } = await importWakeScheduler();
  await syncWakeTasks("scheduled", [{ day: 1, startMin: 540, endMin: 600 }]);
  assert.equal(execFileCalls.length, 0);
});

test(
  "win32: clears stale wake tasks and skips registration when mode is not scheduled",
  { concurrency: false },
  withWin32(async () => {
    resetExecMock();
    const { syncWakeTasks } = await importWakeScheduler();
    await syncWakeTasks("manual", [{ day: 1, startMin: 540, endMin: 600 }]);

    assert.equal(schtasksCalls("/Query").length, 1);
    const deleteCalls = schtasksCalls("/Delete");
    assert.equal(deleteCalls.length, 1);
    assert.equal(deleteCalls[0].args.includes("CloudGamingWake_0_Monday_540"), true);
    assert.equal(powershellCalls().length, 0);
  }),
);

test(
  "win32: clears wake tasks when schedule mode is scheduled but slots are empty",
  { concurrency: false },
  withWin32(async () => {
    resetExecMock();
    const { syncWakeTasks } = await importWakeScheduler();
    await syncWakeTasks("scheduled", []);

    assert.equal(schtasksCalls("/Query").length, 1);
    assert.equal(schtasksCalls("/Delete").length, 1);
    assert.equal(powershellCalls().length, 0);
  }),
);

test(
  "win32: registers WakeToRun scheduled tasks for each slot",
  { concurrency: false },
  withWin32(async () => {
    resetExecMock();
    const { syncWakeTasks } = await importWakeScheduler();
    const slots = [
      { day: 1, startMin: 540, endMin: 600 },
      { day: 3, startMin: 120, endMin: 180 },
    ];
    await syncWakeTasks("scheduled", slots);

    assert.equal(schtasksCalls("/Query").length, 1);
    assert.equal(schtasksCalls("/Delete").length, 1);

    const psCalls = powershellCalls();
    assert.equal(psCalls.length, 2);

    const script0 = psCalls[0].args[psCalls[0].args.length - 1];
    assert.match(script0, /Register-ScheduledTask -TaskName 'CloudGamingWake_0_Monday_540'/);
    assert.match(script0, /New-ScheduledTaskSettingsSet -WakeToRun/);
    assert.match(script0, /New-ScheduledTaskTrigger -Weekly -DaysOfWeek \w+ -At \d{2}:\d{2}/);
    assert.match(script0, new RegExp(`-Execute '${process.execPath.replace(/'/g, "''")}'`));

    const script1 = psCalls[1].args[psCalls[1].args.length - 1];
    assert.match(script1, /Register-ScheduledTask -TaskName 'CloudGamingWake_1_Wednesday_120'/);
  }),
);

test(
  "win32: swallows schtasks query failures during cleanup",
  { concurrency: false },
  withWin32(async () => {
    resetExecMock();
    execFileBehavior.failQuery = true;
    const { syncWakeTasks } = await importWakeScheduler();
    await syncWakeTasks("manual", []);
    assert.equal(schtasksCalls("/Query").length, 1);
    assert.equal(schtasksCalls("/Delete").length, 0);
    assert.equal(powershellCalls().length, 0);
  }),
);

test(
  "win32: continues when deleting a stale task fails",
  { concurrency: false },
  withWin32(async () => {
    resetExecMock();
    execFileBehavior.failDeleteNames.add("CloudGamingWake_0_Monday_540");
    const { syncWakeTasks } = await importWakeScheduler();
    await syncWakeTasks("scheduled", [{ day: 2, startMin: 60, endMin: 120 }]);
    assert.equal(schtasksCalls("/Delete").length, 1);
    assert.equal(powershellCalls().length, 1);
  }),
);

test(
  "win32: continues registering remaining slots when powershell fails for one slot",
  { concurrency: false },
  withWin32(async () => {
    resetExecMock();
    execFileBehavior.failPowershellIndices.add(0);
    const { syncWakeTasks } = await importWakeScheduler();
    await syncWakeTasks("scheduled", [
      { day: 0, startMin: 0, endMin: 60 },
      { day: 4, startMin: 900, endMin: 960 },
    ]);
    assert.equal(powershellCalls().length, 2);
  }),
);
