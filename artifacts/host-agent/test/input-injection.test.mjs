import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";

/** Captured SendInput calls for win32 + koffi tests. */
let sendInputCalls = [];

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
    const user32Funcs = (sig) => {
      if (sig.includes("SendInput")) {
        return (count, inputs) => {
          sendInputCalls.push({ count, inputs: structuredClone(inputs) });
          return count;
        };
      }
      if (sig.includes("GetSystemMetrics")) return () => 1920;
      if (sig.includes("RegisterRawInputDevices")) return () => true;
      return () => 0;
    };
    return {
      struct: () => ({}),
      union: () => ({}),
      sizeof: () => 40,
      load: (dll) => {
        if (dll === "user32.dll") return { func: user32Funcs };
        return { func: () => () => 0 };
      },
    };
  }
  return load.apply(this, arguments);
};

let importNonce = 0;

async function importInputModule() {
  importNonce += 1;
  const url = new URL("../dist/main/main/input-injection.js", import.meta.url);
  url.searchParams.set("v", String(importNonce));
  return import(url.href);
}

function resetSendInputCalls() {
  sendInputCalls = [];
}

beforeEach(() => {
  resetSendInputCalls();
});

test("getInjectorStatus reflects platform after init", async () => {
  const { getInjectorStatus, initInputInjector } = await importInputModule();
  initInputInjector();
  const status = getInjectorStatus();
  assert.equal(typeof status.ok, "boolean");
  assert.equal(typeof status.error, "string");
  assert.equal(status.platform, process.platform);
  if (process.platform !== "win32") {
    assert.equal(status.ok, true);
    assert.equal(status.error, "");
  }
});

test("non-win32: init uses noop backend and injectInput does not throw", async () => {
  if (process.platform === "win32") return;
  const { initInputInjector, injectInput, getInjectorStatus } =
    await importInputModule();
  initInputInjector();
  const status = getInjectorStatus();
  assert.equal(status.ok, true);
  assert.equal(status.error, "");
  injectInput({ kind: "mousemove", x: 0.5, y: 0.5 });
  injectInput({ kind: "keydown", code: "KeyW", key: "w" });
  assert.equal(sendInputCalls.length, 0);
});

test("win32 mocked: absolute mousemove maps to SendInput virtual desktop coords", async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetSendInputCalls();

  const { initInputInjector, injectInput } = await importInputModule();
  initInputInjector();

  injectInput({ kind: "mousemove", x: 0.5, y: 0.25, mode: "absolute" });

  assert.equal(sendInputCalls.length, 1);
  const input = sendInputCalls[0].inputs[0];
  assert.equal(input.type, 0);
  assert.equal(input.u.mi.dx, Math.round(0.5 * 65535));
  assert.equal(input.u.mi.dy, Math.round(0.25 * 65535));
  assert.equal(input.u.mi.dwFlags, 0x0001 | 0x8000 | 0x4000);

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32 mocked: relative mousemove clamps deltas and skips zero move", async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetSendInputCalls();

  const { initInputInjector, injectInput } = await importInputModule();
  initInputInjector();

  injectInput({ kind: "mousemove", x: -3, y: 7, mode: "relative" });
  injectInput({ kind: "mousemove", x: 0, y: 0, mode: "relative" });

  assert.equal(sendInputCalls.length, 1);
  const input = sendInputCalls[0].inputs[0];
  assert.equal(input.u.mi.dx, -3);
  assert.equal(input.u.mi.dy, 7);
  assert.equal(input.u.mi.dwFlags, 0x0001);

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32 mocked: mouse buttons and wheel map to SendInput flags", async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetSendInputCalls();

  const { initInputInjector, injectInput } = await importInputModule();
  initInputInjector();

  injectInput({ kind: "mousedown", button: "left" });
  injectInput({ kind: "mouseup", button: "right" });
  injectInput({ kind: "wheel", deltaY: -120 });

  assert.equal(sendInputCalls.length, 3);
  assert.equal(sendInputCalls[0].inputs[0].u.mi.dwFlags, 0x0002);
  assert.equal(sendInputCalls[1].inputs[0].u.mi.dwFlags, 0x0010);
  assert.equal(sendInputCalls[2].inputs[0].u.mi.dwFlags, 0x0800);
  assert.equal(sendInputCalls[2].inputs[0].u.mi.mouseData, 120);

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32 mocked: keyboard events map code to VK and extended flag", async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetSendInputCalls();

  const { initInputInjector, injectInput } = await importInputModule();
  initInputInjector();

  injectInput({ kind: "keydown", code: "KeyW", key: "w" });
  injectInput({ kind: "keyup", code: "ArrowRight", key: "ArrowRight" });

  assert.equal(sendInputCalls.length, 2);
  assert.equal(sendInputCalls[0].inputs[0].type, 1);
  assert.equal(sendInputCalls[0].inputs[0].u.ki.wVk, "W".charCodeAt(0));
  assert.equal(sendInputCalls[0].inputs[0].u.ki.dwFlags, 0);
  assert.equal(sendInputCalls[1].inputs[0].u.ki.wVk, 0x27);
  assert.equal(sendInputCalls[1].inputs[0].u.ki.dwFlags, 0x0002 | 0x0001);

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32 mocked: koffi init failure sets Russian error status", async () => {
  const origPlatform = process.platform;
  const origLoad = Module._load;
  Object.defineProperty(process, "platform", { value: "win32" });

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
      throw new Error("koffi load failed");
    }
    return origLoad.apply(this, arguments);
  };

  const { initInputInjector, getInjectorStatus } = await importInputModule();
  initInputInjector();
  const status = getInjectorStatus();
  assert.equal(status.ok, false);
  assert.match(status.error, /Модуль управления/);
  assert.match(status.error, /koffi load failed/);

  Module._load = load;
  Object.defineProperty(process, "platform", { value: origPlatform });
});
