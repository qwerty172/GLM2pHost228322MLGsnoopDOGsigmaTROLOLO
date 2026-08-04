import { test, mock } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { promisify } from "node:util";

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "host-agent-wake-scheduler-"));

/** @type {{ calls: Array<{ file: string; args: string[] }>; queryStdout: string; queryError: Error | null; deleteError: Error | null; powershellError: Error | null }} */
let execFileMock = {
  calls: [],
  queryStdout: "",
  queryError: null,
  deleteError: null,
  powershellError: null,
};

function resetExecFileMock() {
  execFileMock = {
    calls: [],
    queryStdout: "",
    queryError: null,
    deleteError: null,
    powershellError: null,
  };
}

function createExecFile(origExecFile) {
  const fn = (file, args, ...rest) => {
    const cb = typeof rest[rest.length - 1] === "function" ? rest[rest.length - 1] : null;
    if (!cb) throw new Error("execFile requires callback");
    execFileMock.calls.push({ file, args: [...args] });

    if (file === "schtasks" && args[0] === "/Query") {
      if (execFileMock.queryError) cb(execFileMock.queryError);
      else cb(null, execFileMock.queryStdout, "");
      return;
    }
    if (file === "schtasks" && args[0] === "/Delete") {
      if (execFileMock.deleteError) cb(execFileMock.deleteError);
      else cb(null, "", "");
      return;
    }
    if (file === "powershell") {
      if (execFileMock.powershellError) cb(execFileMock.powershellError);
      else cb(null, "", "");
      return;
    }
    cb(new Error(`unexpected execFile: ${file}`));
  };
  if (origExecFile?.[promisify.custom]) {
    fn[promisify.custom] = (file, args, options) =>
      new Promise((resolve, reject) => {
        fn(file, args, options, (err, stdout, stderr) => {
          if (err) reject(err);
          else resolve({ stdout, stderr });
        });
      });
  }
  return fn;
}

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return { app: { getAppPath: () => tmpRoot } };
  }
  if (request === "node:child_process") {
    const orig = load.apply(this, arguments);
    return { ...orig, execFile: createExecFile(orig.execFile) };
  }
  return load.apply(this, arguments);
};

async function importWakeScheduler() {
  const url = new URL("../dist/main/main/wake-scheduler.js", import.meta.url);
  url.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  return import(url.href);
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

test("non-win32: syncWakeTasks skips without calling schtasks", { concurrency: false }, async () => {
  if (process.platform === "win32") return;
  resetExecFileMock();
  const restoreLog = mock.method(console, "log", () => {});
  const restoreError = mock.method(console, "error", () => {});
  try {
    const { syncWakeTasks } = await importWakeScheduler();
    await syncWakeTasks("scheduled", [{ day: 1, startMin: 540, endMin: 600 }]);
    assert.equal(execFileMock.calls.length, 0);
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

test(
  "win32: non-scheduled mode clears stale tasks and skips registration",
  { concurrency: false },
  withWin32(async () => {
    resetExecFileMock();
    execFileMock.queryStdout = '"CloudGamingWake_0_Sunday_540","Ready"\n';
    const restoreLog = mock.method(console, "log", () => {});
    try {
      const { syncWakeTasks } = await importWakeScheduler();
      await syncWakeTasks("always", [{ day: 1, startMin: 540, endMin: 600 }]);

      const query = execFileMock.calls.find((c) => c.file === "schtasks" && c.args[0] === "/Query");
      const del = execFileMock.calls.find(
        (c) => c.file === "schtasks" && c.args[0] === "/Delete",
      );
      const ps = execFileMock.calls.find((c) => c.file === "powershell");

      assert.ok(query);
      assert.ok(del);
      assert.equal(del.args[2], "CloudGamingWake_0_Sunday_540");
      assert.equal(ps, undefined);
      assert.ok(
        restoreLog.mock.calls.some((c) =>
          String(c.arguments[0]).includes("No active schedule"),
        ),
      );
    } finally {
      restoreLog.mock.restore();
    }
  }),
);

test(
  "win32: empty slots clears tasks without powershell registration",
  { concurrency: false },
  withWin32(async () => {
    resetExecFileMock();
    const restoreLog = mock.method(console, "log", () => {});
    try {
      const { syncWakeTasks } = await importWakeScheduler();
      await syncWakeTasks("scheduled", []);

      assert.ok(execFileMock.calls.some((c) => c.file === "schtasks" && c.args[0] === "/Query"));
      assert.equal(
        execFileMock.calls.filter((c) => c.file === "powershell").length,
        0,
      );
      assert.ok(
        restoreLog.mock.calls.some((c) =>
          String(c.arguments[0]).includes("No active schedule"),
        ),
      );
    } finally {
      restoreLog.mock.restore();
    }
  }),
);

test(
  "win32: scheduled slots register WakeToRun tasks via PowerShell",
  { concurrency: false },
  withWin32(async () => {
    resetExecFileMock();
    const restoreLog = mock.method(console, "log", () => {});
    try {
      const { syncWakeTasks } = await importWakeScheduler();
      const slots = [
        { day: 1, startMin: 540, endMin: 600 },
        { day: 3, startMin: 1200, endMin: 1260 },
      ];
      await syncWakeTasks("scheduled", slots);

      const psCalls = execFileMock.calls.filter((c) => c.file === "powershell");
      assert.equal(psCalls.length, 2);

      const script0 = psCalls[0].args[3];
      assert.match(script0, /CloudGamingWake_0_Monday_540/);
      assert.match(script0, /New-ScheduledTaskSettingsSet -WakeToRun/);
      assert.match(script0, /Register-ScheduledTask/);
      assert.match(script0, /-Argument '--hidden'/);

      const script1 = psCalls[1].args[3];
      assert.match(script1, /CloudGamingWake_1_Wednesday_1200/);

      assert.ok(
        restoreLog.mock.calls.some((c) =>
          String(c.arguments[0]).includes("Registered 2 wake task(s)"),
        ),
      );
    } finally {
      restoreLog.mock.restore();
    }
  }),
);

test(
  "win32: schtasks query failure is swallowed and schedule still proceeds",
  { concurrency: false },
  withWin32(async () => {
    resetExecFileMock();
    execFileMock.queryError = new Error("schtasks unavailable");
    const restoreLog = mock.method(console, "log", () => {});
    try {
      const { syncWakeTasks } = await importWakeScheduler();
      await syncWakeTasks("scheduled", [{ day: 0, startMin: 60, endMin: 120 }]);

      assert.ok(
        restoreLog.mock.calls.some((c) =>
          String(c.arguments[0]).includes("Failed to list existing wake tasks"),
        ),
      );
      assert.equal(
        execFileMock.calls.filter((c) => c.file === "powershell").length,
        1,
      );
    } finally {
      restoreLog.mock.restore();
    }
  }),
);
