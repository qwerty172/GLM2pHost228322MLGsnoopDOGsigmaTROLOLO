import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { promisify } from "node:util";

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "host-agent-wake-"));

/** Captured execFile calls and mock behaviour. */
let execFileMock = {
  calls: [],
  failQuery: false,
  failDelete: false,
  failRegister: false,
  queryStdout: "",
};

function mockExecFile(file, args = []) {
  execFileMock.calls.push({ file, args });

  if (file === "schtasks" && args[0] === "/Query") {
    if (execFileMock.failQuery) {
      return Promise.reject(new Error("schtasks query failed"));
    }
    return Promise.resolve({ stdout: execFileMock.queryStdout, stderr: "" });
  }
  if (file === "schtasks" && args[0] === "/Delete") {
    if (execFileMock.failDelete) {
      return Promise.reject(new Error("schtasks delete failed"));
    }
    return Promise.resolve({ stdout: "", stderr: "" });
  }
  if (file === "powershell") {
    if (execFileMock.failRegister) {
      return Promise.reject(new Error("powershell register failed"));
    }
    return Promise.resolve({ stdout: "", stderr: "" });
  }
  return Promise.resolve({ stdout: "", stderr: "" });
}

mockExecFile[promisify.custom] = mockExecFile;

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return { app: { getAppPath: () => tmpRoot } };
  }
  if (request === "node:child_process") {
    return { execFile: mockExecFile };
  }
  return load.apply(this, arguments);
};

async function importWakeScheduler() {
  const url = new URL("../dist/main/main/wake-scheduler.js", import.meta.url);
  url.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  return import(url.href);
}

function resetExecFileMock() {
  execFileMock = {
    calls: [],
    failQuery: false,
    failDelete: false,
    failRegister: false,
    queryStdout: "",
  };
}

function setWin32Platform() {
  const orig = process.platform;
  Object.defineProperty(process, "platform", { value: "win32", configurable: true });
  return () => Object.defineProperty(process, "platform", { value: orig, configurable: true });
}

test("non-win32: syncWakeTasks skips without schtasks calls", { concurrency: false }, async () => {
  if (process.platform === "win32") return;
  resetExecFileMock();
  const { syncWakeTasks } = await importWakeScheduler();

  await syncWakeTasks("scheduled", [{ day: 1, startMin: 540, endMin: 1020 }]);

  assert.equal(execFileMock.calls.length, 0);
});

test("win32: clears wake tasks when schedule mode is not scheduled", { concurrency: false }, async () => {
  const restorePlatform = setWin32Platform();
  resetExecFileMock();
  execFileMock.queryStdout = '"CloudGamingWake_0_Monday_540"\n';

  const { syncWakeTasks } = await importWakeScheduler();
  await syncWakeTasks("always", [{ day: 1, startMin: 540, endMin: 1020 }]);

  const queryCall = execFileMock.calls.find(
    (c) => c.file === "schtasks" && c.args[0] === "/Query",
  );
  assert.ok(queryCall);
  const deleteCalls = execFileMock.calls.filter(
    (c) => c.file === "schtasks" && c.args[0] === "/Delete",
  );
  assert.equal(deleteCalls.length, 1);
  assert.equal(deleteCalls[0].args[2], "CloudGamingWake_0_Monday_540");
  assert.equal(
    execFileMock.calls.filter((c) => c.file === "powershell").length,
    0,
  );

  restorePlatform();
});

test("win32: clears wake tasks when slots array is empty", { concurrency: false }, async () => {
  const restorePlatform = setWin32Platform();
  resetExecFileMock();

  const { syncWakeTasks } = await importWakeScheduler();
  await syncWakeTasks("scheduled", []);

  assert.ok(execFileMock.calls.some((c) => c.file === "schtasks" && c.args[0] === "/Query"));
  assert.equal(
    execFileMock.calls.filter((c) => c.file === "powershell").length,
    0,
  );

  restorePlatform();
});

test("win32: registers wake tasks for each scheduled slot", { concurrency: false }, async () => {
  const restorePlatform = setWin32Platform();
  resetExecFileMock();

  const { syncWakeTasks } = await importWakeScheduler();
  const slots = [
    { day: 1, startMin: 540, endMin: 1020 },
    { day: 3, startMin: 1200, endMin: 1380 },
  ];
  await syncWakeTasks("scheduled", slots);

  const psCalls = execFileMock.calls.filter((c) => c.file === "powershell");
  assert.equal(psCalls.length, 2);

  const script0 = psCalls[0].args[3];
  assert.match(script0, /CloudGamingWake_0_Monday_540/);
  assert.match(script0, /New-ScheduledTaskTrigger -Weekly -DaysOfWeek/);
  assert.match(script0, /-WakeToRun/);
  assert.match(script0, /-Argument '--hidden'/);

  const script1 = psCalls[1].args[3];
  assert.match(script1, /CloudGamingWake_1_Wednesday_1200/);

  restorePlatform();
});

test("win32: deletes only tasks matching CloudGamingWake_ prefix", { concurrency: false }, async () => {
  const restorePlatform = setWin32Platform();
  resetExecFileMock();
  execFileMock.queryStdout = [
    '"CloudGamingWake_0_Monday_540"',
    '"OtherTask"',
    '"CloudGamingWake_1_Wednesday_1200"',
  ].join("\n");

  const { syncWakeTasks } = await importWakeScheduler();
  await syncWakeTasks("always", []);

  const deleteCalls = execFileMock.calls.filter(
    (c) => c.file === "schtasks" && c.args[0] === "/Delete",
  );
  assert.equal(deleteCalls.length, 2);
  assert.deepEqual(
    deleteCalls.map((c) => c.args[2]),
    ["CloudGamingWake_0_Monday_540", "CloudGamingWake_1_Wednesday_1200"],
  );

  restorePlatform();
});

test("win32: schtasks query failure is non-fatal", { concurrency: false }, async () => {
  const restorePlatform = setWin32Platform();
  resetExecFileMock();
  execFileMock.failQuery = true;

  const { syncWakeTasks } = await importWakeScheduler();
  await assert.doesNotReject(
    syncWakeTasks("scheduled", [{ day: 0, startMin: 60, endMin: 120 }]),
  );

  restorePlatform();
});

test("win32: powershell registration failure is non-fatal", { concurrency: false }, async () => {
  const restorePlatform = setWin32Platform();
  resetExecFileMock();
  execFileMock.failRegister = true;

  const { syncWakeTasks } = await importWakeScheduler();
  await assert.doesNotReject(
    syncWakeTasks("scheduled", [{ day: 2, startMin: 480, endMin: 960 }]),
  );

  assert.equal(
    execFileMock.calls.filter((c) => c.file === "powershell").length,
    1,
  );

  restorePlatform();
});
