import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { promisify } from "node:util";

/** @type {{ calls: Array<{ file: string; args: string[] }>; queryStdout: string; queryFail: boolean; deleteFailFor: Set<string>; createFail: boolean }} */
let execMock = {
  calls: [],
  queryStdout: "",
  queryFail: false,
  deleteFailFor: new Set(),
  createFail: false,
};

function resetExecMock() {
  execMock = {
    calls: [],
    queryStdout: "",
    queryFail: false,
    deleteFailFor: new Set(),
    createFail: false,
  };
}

function execFileMock(file, args, options, callback) {}

execFileMock[promisify.custom] = async function promisifiedExecFile(file, args) {
  execMock.calls.push({ file, args: [...args] });

  if (file === "schtasks") {
    if (args[0] === "/Query") {
      if (execMock.queryFail) throw new Error("schtasks query failed");
      return { stdout: execMock.queryStdout, stderr: "" };
    }
    if (args[0] === "/Delete") {
      const taskName = args[2];
      if (execMock.deleteFailFor.has(taskName)) throw new Error(`delete failed: ${taskName}`);
      return { stdout: "", stderr: "" };
    }
  }
  if (file === "powershell") {
    if (execMock.createFail) throw new Error("powershell failed");
    return { stdout: "", stderr: "" };
  }
  return { stdout: "", stderr: "" };
};

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return { app: { getAppPath: () => "/tmp/test-wake-agent" } };
  }
  if (request === "node:child_process") {
    return { execFile: execFileMock };
  }
  return load.apply(this, arguments);
};

async function importWakeScheduler() {
  const url = new URL("../dist/main/main/wake-scheduler.js", import.meta.url);
  url.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  return import(url.href);
}

const sampleSlot = { day: 1, startMin: 540, endMin: 1080 };

test("non-win32: syncWakeTasks is a no-op", { concurrency: false }, async () => {
  if (process.platform === "win32") return;
  resetExecMock();
  const { syncWakeTasks } = await importWakeScheduler();
  await syncWakeTasks("scheduled", [sampleSlot]);
  assert.equal(execMock.calls.length, 0);
});

test("win32 manual mode clears wake tasks without creating new ones", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetExecMock();
  execMock.queryStdout = '"CloudGamingWake_0_Monday_540"\n';

  try {
    const { syncWakeTasks } = await importWakeScheduler();
    await syncWakeTasks("manual", [sampleSlot]);

    assert.equal(
      execMock.calls.filter((c) => c.file === "schtasks" && c.args[0] === "/Query").length,
      1,
    );
    assert.equal(
      execMock.calls.filter((c) => c.file === "schtasks" && c.args[0] === "/Delete").length,
      1,
    );
    assert.equal(execMock.calls.filter((c) => c.file === "powershell").length, 0);
  } finally {
    Object.defineProperty(process, "platform", { value: origPlatform });
  }
});

test("win32 scheduled mode with empty slots clears without creating", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetExecMock();

  try {
    const { syncWakeTasks } = await importWakeScheduler();
    await syncWakeTasks("scheduled", []);

    assert.equal(
      execMock.calls.filter((c) => c.file === "schtasks" && c.args[0] === "/Query").length,
      1,
    );
    assert.equal(execMock.calls.filter((c) => c.file === "powershell").length, 0);
  } finally {
    Object.defineProperty(process, "platform", { value: origPlatform });
  }
});

test("win32 scheduled mode registers wake tasks for each slot", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetExecMock();
  execMock.queryStdout = '"CloudGamingWake_old"\n"UnrelatedTask"\n';

  try {
    const { syncWakeTasks } = await importWakeScheduler();
    await syncWakeTasks("scheduled", [
      sampleSlot,
      { day: 3, startMin: 600, endMin: 1200 },
    ]);

    const deletes = execMock.calls.filter((c) => c.file === "schtasks" && c.args[0] === "/Delete");
    assert.equal(deletes.length, 1);
    assert.equal(deletes[0].args[2], "CloudGamingWake_old");

    const powershellCalls = execMock.calls.filter((c) => c.file === "powershell");
    assert.equal(powershellCalls.length, 2);
    for (const call of powershellCalls) {
      const script = call.args[3];
      assert.match(script, /Register-ScheduledTask/);
      assert.match(script, /WakeToRun/);
      assert.match(script, /CloudGamingWake_/);
    }
  } finally {
    Object.defineProperty(process, "platform", { value: origPlatform });
  }
});

test("win32 swallows schtasks query failure", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetExecMock();
  execMock.queryFail = true;

  try {
    const { syncWakeTasks } = await importWakeScheduler();
    await syncWakeTasks("scheduled", [sampleSlot]);

    const powershellCalls = execMock.calls.filter((c) => c.file === "powershell");
    assert.equal(powershellCalls.length, 1);
  } finally {
    Object.defineProperty(process, "platform", { value: origPlatform });
  }
});

test("win32 continues when deleting a stale task fails", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetExecMock();
  execMock.queryStdout = '"CloudGamingWake_stale"\n';
  execMock.deleteFailFor.add("CloudGamingWake_stale");

  try {
    const { syncWakeTasks } = await importWakeScheduler();
    await syncWakeTasks("scheduled", [sampleSlot]);

    assert.equal(execMock.calls.filter((c) => c.file === "powershell").length, 1);
  } finally {
    Object.defineProperty(process, "platform", { value: origPlatform });
  }
});

test("win32 continues when registering a wake task fails", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetExecMock();
  execMock.createFail = true;

  try {
    const { syncWakeTasks } = await importWakeScheduler();
    await syncWakeTasks("scheduled", [sampleSlot, { day: 5, startMin: 720, endMin: 1320 }]);

    assert.equal(execMock.calls.filter((c) => c.file === "powershell").length, 2);
  } finally {
    Object.defineProperty(process, "platform", { value: origPlatform });
  }
});

test("win32 deletes all existing CloudGamingWake tasks before registering", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetExecMock();
  execMock.queryStdout =
    '"CloudGamingWake_0_Monday_540"\n"CloudGamingWake_1_Wednesday_600"\n"OtherAppTask"\n';

  try {
    const { syncWakeTasks } = await importWakeScheduler();
    await syncWakeTasks("scheduled", [sampleSlot]);

    const deletes = execMock.calls.filter((c) => c.file === "schtasks" && c.args[0] === "/Delete");
    assert.equal(deletes.length, 2);
    assert.deepEqual(
      deletes.map((c) => c.args[2]).sort(),
      ["CloudGamingWake_0_Monday_540", "CloudGamingWake_1_Wednesday_600"],
    );
  } finally {
    Object.defineProperty(process, "platform", { value: origPlatform });
  }
});
