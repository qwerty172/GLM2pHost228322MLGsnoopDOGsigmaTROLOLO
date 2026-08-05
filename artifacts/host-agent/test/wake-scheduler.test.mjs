import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { promisify } from "node:util";

/** @type {{ calls: Array<{ cmd: string; args: string[] }>; failQuery: boolean; failDelete: Set<string>; failPowershell: boolean; queryOutput: string }} */
let execFileMock = {
  calls: [],
  failQuery: false,
  failDelete: new Set(),
  failPowershell: false,
  queryOutput: '"CloudGamingWake_0_Monday_600"\n"OtherTask"\n',
};

function runMockExecFile(cmd, args, cb) {
  execFileMock.calls.push({ cmd, args: [...args] });

  if (cmd === "schtasks" && args[0] === "/Query") {
    if (execFileMock.failQuery) {
      cb(new Error("schtasks query failed"));
      return;
    }
    cb(null, execFileMock.queryOutput, "");
    return;
  }

  if (cmd === "schtasks" && args[0] === "/Delete") {
    const tnIndex = args.indexOf("/TN");
    const name = tnIndex >= 0 ? args[tnIndex + 1] : "";
    if (execFileMock.failDelete.has(name)) {
      cb(new Error(`delete failed: ${name}`));
      return;
    }
    cb(null, "", "");
    return;
  }

  if (cmd === "powershell") {
    if (execFileMock.failPowershell) {
      cb(new Error("powershell failed"));
      return;
    }
    cb(null, "", "");
    return;
  }

  cb(new Error(`unexpected execFile: ${cmd} ${args.join(" ")}`));
}

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return { app: { getAppPath: () => "/tmp/test-wake-scheduler" } };
  }
  if (request === "node:child_process") {
    const orig = load.apply(this, arguments);
    const mockExecFile = (cmd, args, ...rest) => {
      const cb = typeof rest[0] === "function" ? rest[0] : rest[1];
      runMockExecFile(cmd, args, cb);
    };
    mockExecFile[promisify.custom] = (cmd, args) =>
      new Promise((resolve, reject) => {
        runMockExecFile(cmd, args, (err, stdout = "", stderr = "") => {
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
    failDelete: new Set(),
    failPowershell: false,
    queryOutput: '"CloudGamingWake_0_Monday_600"\n"OtherTask"\n',
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

function schtasksCalls() {
  return execFileMock.calls.filter((c) => c.cmd === "schtasks");
}

function powershellCalls() {
  return execFileMock.calls.filter((c) => c.cmd === "powershell");
}

test("non-win32: syncWakeTasks is a no-op", { concurrency: false }, async () => {
  if (process.platform === "win32") return;
  resetExecMock();
  const { syncWakeTasks } = await importWakeScheduler();
  await syncWakeTasks("scheduled", [{ day: 1, startMin: 600, endMin: 720 }]);
  assert.equal(execFileMock.calls.length, 0);
});

test(
  "win32: clears stale tasks when schedule is not active",
  { concurrency: false },
  withWin32(async () => {
    resetExecMock();
    const { syncWakeTasks } = await importWakeScheduler();

    await syncWakeTasks("always", []);
    const sch = schtasksCalls();
    assert.equal(sch.length, 2);
    assert.deepEqual(sch[0].args.slice(0, 3), ["/Query", "/FO", "CSV"]);
    assert.deepEqual(sch[1].args, ["/Delete", "/TN", "CloudGamingWake_0_Monday_600", "/F"]);
    assert.equal(powershellCalls().length, 0);
  }),
);

test(
  "win32: clears stale tasks when mode is scheduled but slots are empty",
  { concurrency: false },
  withWin32(async () => {
    resetExecMock();
    const { syncWakeTasks } = await importWakeScheduler();

    await syncWakeTasks("scheduled", []);
    assert.equal(schtasksCalls().length, 2);
    assert.equal(powershellCalls().length, 0);
  }),
);

test(
  "win32: registers wake tasks for each scheduled slot",
  { concurrency: false },
  withWin32(async () => {
    resetExecMock();
    execFileMock.queryOutput = "\n";
    const { syncWakeTasks } = await importWakeScheduler();
    const slots = [
      { day: 1, startMin: 600, endMin: 720 },
      { day: 3, startMin: 90, endMin: 180 },
    ];

    await syncWakeTasks("scheduled", slots);

    assert.equal(schtasksCalls().length, 1);
    assert.equal(powershellCalls().length, 2);

    const script0 = powershellCalls()[0].args[3];
    assert.match(script0, /CloudGamingWake_0_Monday_600/);
    assert.match(script0, /DaysOfWeek Monday/);
    assert.match(script0, /WakeToRun/);
    assert.match(script0, /Register-ScheduledTask/);
    assert.match(script0, new RegExp(process.execPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

    const script1 = powershellCalls()[1].args[3];
    assert.match(script1, /CloudGamingWake_1_Wednesday_90/);
    assert.match(script1, /DaysOfWeek Wednesday/);
  }),
);

test(
  "win32: only deletes tasks matching CloudGamingWake_ prefix",
  { concurrency: false },
  withWin32(async () => {
    resetExecMock();
    execFileMock.queryOutput =
      '"CloudGamingWake_0_Sunday_0"\n"UnrelatedTask"\n"CloudGamingWake_1_Tuesday_120"\n';
    const { syncWakeTasks } = await importWakeScheduler();

    await syncWakeTasks("always", []);

    const deletes = schtasksCalls().filter((c) => c.args[0] === "/Delete");
    assert.equal(deletes.length, 2);
    assert.deepEqual(deletes[0].args, ["/Delete", "/TN", "CloudGamingWake_0_Sunday_0", "/F"]);
    assert.deepEqual(deletes[1].args, ["/Delete", "/TN", "CloudGamingWake_1_Tuesday_120", "/F"]);
  }),
);

test(
  "win32: swallows schtasks query failures",
  { concurrency: false },
  withWin32(async () => {
    resetExecMock();
    execFileMock.failQuery = true;
    const { syncWakeTasks } = await importWakeScheduler();

    await assert.doesNotReject(
      syncWakeTasks("scheduled", [{ day: 0, startMin: 0, endMin: 60 }]),
    );
    assert.equal(schtasksCalls().length, 1);
    assert.equal(powershellCalls().length, 1);
  }),
);

test(
  "win32: swallows individual task delete failures",
  { concurrency: false },
  withWin32(async () => {
    resetExecMock();
    execFileMock.failDelete.add("CloudGamingWake_0_Monday_600");
    const { syncWakeTasks } = await importWakeScheduler();

    await assert.doesNotReject(syncWakeTasks("always", []));
    assert.equal(
      schtasksCalls().filter((c) => c.args[0] === "/Delete").length,
      1,
    );
  }),
);

test(
  "win32: swallows powershell registration failures",
  { concurrency: false },
  withWin32(async () => {
    resetExecMock();
    execFileMock.queryOutput = "\n";
    execFileMock.failPowershell = true;
    const { syncWakeTasks } = await importWakeScheduler();

    await assert.doesNotReject(
      syncWakeTasks("scheduled", [{ day: 5, startMin: 480, endMin: 600 }]),
    );
    assert.equal(powershellCalls().length, 1);
  }),
);
