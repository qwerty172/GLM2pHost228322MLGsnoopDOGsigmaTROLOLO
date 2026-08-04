import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";

/** Captured SendInput calls for win32 + koffi tests. */
let sendInputCalls = [];
let rawInputRegisterCalls = 0;
let koffiShouldFail = false;

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return {
      app: {
        getAppPath: () => "/tmp/test-input-agent",
        getPath: () => "/tmp/test-input-agent",
      },
    };
  }
  if (request === "koffi") {
    if (koffiShouldFail) {
      throw new Error("koffi load failed (test)");
    }
    const user32Funcs = (sig) => {
      if (sig.includes("SendInput")) {
        return (count, inputs, size) => {
          sendInputCalls.push({ count, inputs, size });
          return count;
        };
      }
      if (sig.includes("GetSystemMetrics")) {
        return () => 1920;
      }
      if (sig.includes("RegisterRawInputDevices")) {
        return () => {
          rawInputRegisterCalls += 1;
          return true;
        };
      }
      return () => {};
    };
    return {
      struct: () => ({}),
      union: () => ({}),
      sizeof: () => 40,
      load: (dll) => {
        if (dll === "user32.dll") return { func: user32Funcs };
        return { func: () => {} };
      },
    };
  }
  return load.apply(this, arguments);
};

async function importInputModule() {
  const url = new URL("../dist/main/main/input-injection.js", import.meta.url);
  url.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  return import(url.href);
}

function resetMocks() {
  sendInputCalls = [];
  rawInputRegisterCalls = 0;
  koffiShouldFail = false;
}

test("getInjectorStatus returns current platform and ok flag", async () => {
  const { getInjectorStatus } = await importInputModule();
  const status = getInjectorStatus();
  assert.equal(typeof status.ok, "boolean");
  assert.equal(typeof status.error, "string");
  assert.equal(status.platform, process.platform);
});

test("non-win32: init and injectInput are no-op", async () => {
  if (process.platform === "win32") return;
  const { initInputInjector, injectInput } = await importInputModule();
  initInputInjector();
  injectInput({ kind: "mousemove", x: 0.5, y: 0.5 });
  injectInput({ kind: "keydown", code: "KeyW", key: "w" });
});

test("win32 mocked: absolute mousemove maps normalized coords to SendInput", async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetMocks();

  const { initInputInjector, injectInput } = await importInputModule();
  initInputInjector();

  injectInput({ kind: "mousemove", x: 0.5, y: 0.25 });
  assert.equal(sendInputCalls.length, 1);
  const mouse = sendInputCalls[0].inputs[0];
  assert.equal(mouse.type, 0);
  assert.equal(mouse.u.mi.dx, Math.round(0.5 * 65535));
  assert.equal(mouse.u.mi.dy, Math.round(0.25 * 65535));
  assert.equal(mouse.u.mi.dwFlags & 0x8000, 0x8000);
  assert.equal(mouse.u.mi.dwFlags & 0x4000, 0x4000);

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32 mocked: relative mousemove clamps deltas and skips zero move", async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetMocks();

  const { initInputInjector, injectInput } = await importInputModule();
  initInputInjector();

  injectInput({ kind: "mousemove", x: 0, y: 0, mode: "relative" });
  assert.equal(sendInputCalls.length, 0);

  injectInput({ kind: "mousemove", x: 5000, y: -5000, mode: "relative" });
  assert.equal(sendInputCalls.length, 1);
  assert.equal(sendInputCalls[0].inputs[0].u.mi.dx, 4096);
  assert.equal(sendInputCalls[0].inputs[0].u.mi.dy, -4096);

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32 mocked: mouse buttons, wheel, and keyboard map to SendInput", async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetMocks();

  const { initInputInjector, injectInput } = await importInputModule();
  initInputInjector();

  injectInput({ kind: "mousedown", button: "left" });
  injectInput({ kind: "mouseup", button: "right" });
  injectInput({ kind: "wheel", deltaY: 240 });
  injectInput({ kind: "keydown", code: "KeyA", key: "a" });
  injectInput({ kind: "keyup", code: "ArrowLeft", key: "ArrowLeft" });

  assert.equal(sendInputCalls.length, 5);
  assert.equal(sendInputCalls[0].inputs[0].u.mi.dwFlags & 0x0002, 0x0002);
  assert.equal(sendInputCalls[1].inputs[0].u.mi.dwFlags & 0x0010, 0x0010);
  assert.equal(sendInputCalls[2].inputs[0].u.mi.mouseData, -240);
  assert.equal(sendInputCalls[3].inputs[0].u.ki.wVk, 0x41);
  assert.equal(sendInputCalls[4].inputs[0].u.ki.wVk, 0x25);
  assert.equal(sendInputCalls[4].inputs[0].u.ki.dwFlags & 0x0002, 0x0002);

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32 mocked: USE_RAW_INPUT registers Raw Input devices", async () => {
  const origPlatform = process.platform;
  const origEnv = process.env.USE_RAW_INPUT;
  Object.defineProperty(process, "platform", { value: "win32" });
  process.env.USE_RAW_INPUT = "1";
  resetMocks();

  const { initInputInjector } = await importInputModule();
  initInputInjector();
  assert.equal(rawInputRegisterCalls, 1);

  process.env.USE_RAW_INPUT = origEnv;
  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32 mocked: koffi failure sets Russian error in injector status", async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetMocks();
  koffiShouldFail = true;

  const { initInputInjector, getInjectorStatus } = await importInputModule();
  initInputInjector();
  const status = getInjectorStatus();
  assert.equal(status.ok, false);
  assert.match(status.error, /Модуль управления/);
  assert.match(status.error, /koffi load failed/);

  Object.defineProperty(process, "platform", { value: origPlatform });
});
