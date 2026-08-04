import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { promisify } from "node:util";

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "host-agent-wake-scheduler-"));

let execFileMock = {
  calls: [],
  failQuery: false,
  failDelete: false,
  failRegister: false,
};

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return { app: { getAppPath: () => tmpRoot } };
  }
  if (request === "node:child_process") {
    const orig = load.apply(this, arguments);
    function mockExecFile(file, args, ...rest) {
      const callback = typeof rest[rest.length - 1] === "function" ? rest[rest.length - 1] : null;
      execFileMock.calls.push({ file, args: [...args] });

      if (file === "schtasks" && args[0] === "/Query") {
        if (execFileMock.failQuery) {
          callback?.(new Error("schtasks query failed"));
          return;
        }
        callback?.(
          null,
          '"CloudGamingWake_0_Sunday_480"\n"SomeOtherTask"\n"CloudGamingWake_1_Monday_600"\n',
          "",
        );
        return;
      }

      if (file === "schtasks" && args[0] === "/Delete") {
        if (execFileMock.failDelete) {
          callback?.(new Error("delete failed"));
          return;
        }
        callback?.(null, "", "");
        return;
      }

      if (file === "powershell") {
        if (execFileMock.failRegister) {
          callback?.(new Error("register failed"));
          return;
        }
        callback?.(null, "", "");
        return;
      }

      callback?.(new Error("unexpected execFile: " + file + " " + args.join(" ")));
    }
    mockExecFile[promisify.custom] = (file, args, options) =>
      new Promise((resolve, reject) => {
        mockExecFile(file, args, options ?? {}, (err, stdout, stderr) => {
          if (err) reject(err);
          else resolve({ stdout, stderr });
        });
      });
    return {
      ...orig,
      execFile: mockExecFile,
    };
  }
  return load.apply(this, arguments);
};

async function importWakeScheduler() {
  const url = new URL("../dist/main/main/wake-scheduler.js", import.meta.url);
  url.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  return import(url.href);
}

function resetExecMock() {
  execFileMock = {
    calls: [],
    failQuery: false,
    failDelete: false,
    failRegister: false,
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

test("non-win32: syncWakeTasks skips without schtasks calls", { concurrency: false }, async () => {
  if (process.platform === "win32") return;
  resetExecMock();
  const { syncWakeTasks } = await importWakeScheduler();
  await syncWakeTasks("scheduled", [{ day: 1, startMin: 480, endMin: 600 }]);
  assert.equal(execFileMock.calls.length, 0);
});

test(
  "win32 always mode: removes stale tasks and skips registration",
  { concurrency: false },
  withWin32(async () => {
    resetExecMock();
    const { syncWakeTasks } = await importWakeScheduler();
    await syncWakeTasks("always", [{ day: 1, startMin: 480, endMin: 600 }]);

    const query = execFileMock.calls.find((c) => c.file === "schtasks" && c.args[0] === "/Query");
    assert.ok(query);
    const deletes = execFileMock.calls.filter((c) => c.file === "schtasks" && c.args[0] === "/Delete");
    assert.equal(deletes.length, 2);
    assert.ok(deletes.some((c) => c.args.includes("CloudGamingWake_0_Sunday_480")));
    assert.ok(deletes.some((c) => c.args.includes("CloudGamingWake_1_Monday_600")));
    assert.equal(
      execFileMock.calls.filter((c) => c.file === "powershell").length,
      0,
    );
  }),
);

test(
  "win32 scheduled with empty slots: clears without powershell",
  { concurrency: false },
  withWin32(async () => {
    resetExecMock();
    const { syncWakeTasks } = await importWakeScheduler();
    await syncWakeTasks("scheduled", []);

    assert.ok(
      execFileMock.calls.some((c) => c.file === "schtasks" && c.args[0] === "/Query"),
    );
    assert.equal(
      execFileMock.calls.filter((c) => c.file === "powershell").length,
      0,
    );
  }),
);

test(
  "win32 scheduled mode: registers wake tasks via powershell",
  { concurrency: false },
  withWin32(async () => {
    resetExecMock();
    const { syncWakeTasks } = await importWakeScheduler();
    const slots = [
      { day: 1, startMin: 480, endMin: 600 },
      { day: 3, startMin: 1020, endMin: 1140 },
    ];
    await syncWakeTasks("scheduled", slots);

    const psCalls = execFileMock.calls.filter((c) => c.file === "powershell");
    assert.equal(psCalls.length, 2);

    const script0 = psCalls[0].args[psCalls[0].args.length - 1];
    assert.match(script0, /New-ScheduledTaskSettingsSet -WakeToRun/);
    assert.match(script0, /CloudGamingWake_0_Monday_480/);
    assert.match(script0, /New-ScheduledTaskTrigger -Weekly -DaysOfWeek/);
    assert.match(script0, /--hidden/);

    const script1 = psCalls[1].args[psCalls[1].args.length - 1];
    assert.match(script1, /CloudGamingWake_1_Wednesday_1020/);
  }),
);

test(
  "win32: schtasks query failure is swallowed",
  { concurrency: false },
  withWin32(async () => {
    resetExecMock();
    execFileMock.failQuery = true;
    const { syncWakeTasks } = await importWakeScheduler();
    await syncWakeTasks("scheduled", [{ day: 0, startMin: 60, endMin: 120 }]);
    assert.equal(
      execFileMock.calls.filter((c) => c.file === "powershell").length,
      1,
    );
  }),
);

test(
  "win32: powershell registration failure is swallowed per slot",
  { concurrency: false },
  withWin32(async () => {
    resetExecMock();
    execFileMock.failRegister = true;
    const { syncWakeTasks } = await importWakeScheduler();
    await syncWakeTasks("scheduled", [
      { day: 2, startMin: 300, endMin: 360 },
      { day: 4, startMin: 720, endMin: 780 },
    ]);
    assert.equal(
      execFileMock.calls.filter((c) => c.file === "powershell").length,
      2,
    );
  }),
);
