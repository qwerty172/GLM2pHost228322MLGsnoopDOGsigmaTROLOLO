import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";

/** Captured SendInput calls when win32 + koffi are mocked. */
let sendInputCalls = [];
let koffiShouldThrow = false;

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
    if (koffiShouldThrow) {
      throw new Error("koffi load failed");
    }
    const user32Funcs = (sig) => {
      if (sig.includes("SendInput")) {
        return (count, inputs) => {
          sendInputCalls.push({ count, inputs: structuredClone(inputs) });
          return count;
        };
      }
      if (sig.includes("GetSystemMetrics")) {
        return () => 1920;
      }
      if (sig.includes("RegisterRawInputDevices")) {
        return () => true;
      }
      return () => 0;
    };
    return {
      struct: () => ({}),
      union: () => ({}),
      sizeof: () => 40,
      load: () => ({ func: user32Funcs }),
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
  koffiShouldThrow = false;
}

const MOUSEEVENTF_MOVE = 0x0001;
const MOUSEEVENTF_LEFTDOWN = 0x0002;
const MOUSEEVENTF_RIGHTUP = 0x0010;
const MOUSEEVENTF_WHEEL = 0x0800;
const MOUSEEVENTF_VIRTUALDESK = 0x4000;
const MOUSEEVENTF_ABSOLUTE = 0x8000;
const INPUT_MOUSE = 0;
const INPUT_KEYBOARD = 1;

test("getInjectorStatus returns a defensive copy", async () => {
  const { getInjectorStatus, initInputInjector } = await importInputModule();
  initInputInjector();
  const status = getInjectorStatus();
  assert.equal(typeof status.ok, "boolean");
  assert.equal(typeof status.error, "string");
  assert.equal(status.platform, process.platform);
  status.ok = false;
  assert.equal(getInjectorStatus().ok, true);
});

test("non-win32: init and injectInput are no-op", async () => {
  if (process.platform === "win32") return;
  const { initInputInjector, injectInput, getInjectorStatus } =
    await importInputModule();
  initInputInjector();
  assert.equal(getInjectorStatus().ok, true);
  injectInput({ kind: "keydown", code: "KeyW", key: "w" });
  injectInput({ kind: "mousemove", x: 0.5, y: 0.5, mode: "absolute" });
});

test("win32 mocked: absolute mousemove maps to virtual desktop coords", async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetMocks();

  const { initInputInjector, injectInput } = await importInputModule();
  initInputInjector();

  injectInput({ kind: "mousemove", x: 0.5, y: 0.25, mode: "absolute" });

  assert.equal(sendInputCalls.length, 1);
  const input = sendInputCalls[0].inputs[0];
  assert.equal(input.type, INPUT_MOUSE);
  assert.equal(
    input.u.mi.dwFlags,
    MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK,
  );
  assert.equal(input.u.mi.dx, Math.round(0.5 * 65535));
  assert.equal(input.u.mi.dy, Math.round(0.25 * 65535));

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32 mocked: relative mousemove clamps deltas", async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetMocks();

  const { initInputInjector, injectInput } = await importInputModule();
  initInputInjector();

  injectInput({ kind: "mousemove", x: 5000, y: -5000, mode: "relative" });

  assert.equal(sendInputCalls.length, 1);
  const mi = sendInputCalls[0].inputs[0].u.mi;
  assert.equal(mi.dwFlags, MOUSEEVENTF_MOVE);
  assert.equal(mi.dx, 4096);
  assert.equal(mi.dy, -4096);

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32 mocked: mouse buttons and wheel", async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetMocks();

  const { initInputInjector, injectInput } = await importInputModule();
  initInputInjector();

  injectInput({ kind: "mousedown", button: "left" });
  injectInput({ kind: "mouseup", button: "right" });
  injectInput({ kind: "wheel", deltaY: -240 });

  assert.equal(sendInputCalls.length, 3);
  assert.equal(sendInputCalls[0].inputs[0].u.mi.dwFlags, MOUSEEVENTF_LEFTDOWN);
  assert.equal(sendInputCalls[1].inputs[0].u.mi.dwFlags, MOUSEEVENTF_RIGHTUP);
  assert.equal(sendInputCalls[2].inputs[0].u.mi.dwFlags, MOUSEEVENTF_WHEEL);
  assert.equal(sendInputCalls[2].inputs[0].u.mi.mouseData, 240);

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32 mocked: keyboard KeyW and extended ArrowLeft", async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetMocks();

  const { initInputInjector, injectInput } = await importInputModule();
  initInputInjector();

  injectInput({ kind: "keydown", code: "KeyW", key: "w" });
  injectInput({ kind: "keydown", code: "ArrowLeft", key: "ArrowLeft" });

  assert.equal(sendInputCalls.length, 2);
  const keyW = sendInputCalls[0].inputs[0];
  assert.equal(keyW.type, INPUT_KEYBOARD);
  assert.equal(keyW.u.ki.wVk, 0x57);
  assert.equal(keyW.u.ki.dwFlags, 0);

  const arrow = sendInputCalls[1].inputs[0];
  assert.equal(arrow.u.ki.wVk, 0x25);
  assert.equal(arrow.u.ki.dwFlags & 0x0001, 0x0001); // KEYEVENTF_EXTENDEDKEY

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32 mocked: koffi init failure sets Russian error status", async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetMocks();
  koffiShouldThrow = true;

  const { initInputInjector, getInjectorStatus } = await importInputModule();
  initInputInjector();

  const status = getInjectorStatus();
  assert.equal(status.ok, false);
  assert.match(status.error, /Модуль управления/);
  assert.match(status.error, /koffi load failed/);

  Object.defineProperty(process, "platform", { value: origPlatform });
});
