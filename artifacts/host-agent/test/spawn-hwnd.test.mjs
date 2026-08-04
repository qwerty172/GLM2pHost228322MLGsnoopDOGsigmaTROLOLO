import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";

/** @type {{ sources: Array<{ id: string, name: string }>, failNext: boolean }} */
let capturerMock = {
  sources: [],
  failNext: false,
};

/** @type {{ foregroundHwnd: number | null, pidByHwnd: Map<number, number>, failInit: boolean }} */
let win32Mock = {
  foregroundHwnd: null,
  pidByHwnd: new Map(),
  failInit: false,
};

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return {
      app: { getAppPath: () => "/tmp/test-spawn-hwnd" },
      desktopCapturer: {
        getSources: async () => {
          if (capturerMock.failNext) throw new Error("getSources failed");
          return capturerMock.sources;
        },
      },
    };
  }
  if (request === "koffi") {
    if (win32Mock.failInit) throw new Error("koffi init failed");
    return {
      load: () => ({
        func: (sig) => {
          if (sig.includes("GetForegroundWindow")) {
            return () => win32Mock.foregroundHwnd;
          }
          if (sig.includes("GetWindowThreadProcessId")) {
            return (hwnd, pidBuf) => {
              const pid = win32Mock.pidByHwnd.get(hwnd);
              if (pid) pidBuf.writeUInt32LE(pid, 0);
            };
          }
          throw new Error(`unexpected koffi func: ${sig}`);
        },
      }),
      decode: (ptr) => Number(ptr),
    };
  }
  return load.apply(this, arguments);
};

async function importSpawnHwnd() {
  const url = new URL("../dist/main/main/spawn-hwnd.js", import.meta.url);
  url.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  return import(url.href);
}

function resetMocks() {
  capturerMock = { sources: [], failNext: false };
  win32Mock = { foregroundHwnd: null, pidByHwnd: new Map(), failInit: false };
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

test("getHwndsForSpawnedPid returns [] for invalid pid", { concurrency: false }, async () => {
  resetMocks();
  const { getHwndsForSpawnedPid } = await importSpawnHwnd();
  assert.deepEqual(await getHwndsForSpawnedPid(0), []);
  assert.deepEqual(await getHwndsForSpawnedPid(-1), []);
});

test("non-win32: getHwndsForSpawnedPid returns []", { concurrency: false }, async () => {
  if (process.platform === "win32") return;
  resetMocks();
  const { getHwndsForSpawnedPid } = await importSpawnHwnd();
  assert.deepEqual(await getHwndsForSpawnedPid(1234), []);
});

test(
  "win32: returns hwnds owned by spawned pid",
  { concurrency: false },
  withWin32(async () => {
    resetMocks();
    win32Mock.pidByHwnd.set(100, 555);
    win32Mock.pidByHwnd.set(200, 555);
    win32Mock.pidByHwnd.set(300, 999);
    capturerMock.sources = [
      { id: "window:100", name: "Game" },
      { id: "window:200", name: "Game Dialog" },
      { id: "window:300", name: "Other" },
      { id: "screen:0:0", name: "Screen" },
      { id: "window:invalid", name: "Bad" },
    ];
    const { getHwndsForSpawnedPid } = await importSpawnHwnd();
    const hwnds = await getHwndsForSpawnedPid(555);
    assert.deepEqual(hwnds, [100, 200]);
  }),
);

test(
  "win32: places foreground hwnd first when owned by pid",
  { concurrency: false },
  withWin32(async () => {
    resetMocks();
    win32Mock.foregroundHwnd = 200;
    win32Mock.pidByHwnd.set(100, 555);
    win32Mock.pidByHwnd.set(200, 555);
    capturerMock.sources = [
      { id: "window:100", name: "Game" },
      { id: "window:200", name: "Game Focused" },
    ];
    const { getHwndsForSpawnedPid } = await importSpawnHwnd();
    const hwnds = await getHwndsForSpawnedPid(555);
    assert.deepEqual(hwnds, [200, 100]);
  }),
);

test(
  "win32: does not reorder when foreground belongs to different pid",
  { concurrency: false },
  withWin32(async () => {
    resetMocks();
    win32Mock.foregroundHwnd = 300;
    win32Mock.pidByHwnd.set(100, 555);
    win32Mock.pidByHwnd.set(200, 555);
    win32Mock.pidByHwnd.set(300, 999);
    capturerMock.sources = [
      { id: "window:100", name: "Game" },
      { id: "window:200", name: "Game Dialog" },
      { id: "window:300", name: "Other" },
    ];
    const { getHwndsForSpawnedPid } = await importSpawnHwnd();
    const hwnds = await getHwndsForSpawnedPid(555);
    assert.deepEqual(hwnds, [100, 200]);
  }),
);

test(
  "win32: returns [] when no matching windows",
  { concurrency: false },
  withWin32(async () => {
    resetMocks();
    capturerMock.sources = [{ id: "window:100", name: "Other" }];
    win32Mock.pidByHwnd.set(100, 999);
    const { getHwndsForSpawnedPid } = await importSpawnHwnd();
    assert.deepEqual(await getHwndsForSpawnedPid(555), []);
  }),
);

test(
  "win32: returns [] when desktopCapturer fails",
  { concurrency: false },
  withWin32(async () => {
    resetMocks();
    capturerMock.failNext = true;
    win32Mock.pidByHwnd.set(100, 555);
    const { getHwndsForSpawnedPid } = await importSpawnHwnd();
    assert.deepEqual(await getHwndsForSpawnedPid(555), []);
  }),
);

test(
  "win32: returns [] when koffi init fails",
  { concurrency: false },
  withWin32(async () => {
    resetMocks();
    win32Mock.failInit = true;
    capturerMock.sources = [{ id: "window:100", name: "Game" }];
    const { getHwndsForSpawnedPid } = await importSpawnHwnd();
    assert.deepEqual(await getHwndsForSpawnedPid(555), []);
  }),
);
