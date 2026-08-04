import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";

/** Mutable user32 mock state for win32 + koffi tests. */
let sendInputMock = {
  calls: [],
  failNext: false,
};

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
          if (sendInputMock.failNext) throw new Error("SendInput failed");
          sendInputMock.calls.push({ count, inputs });
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
      struct: (name) => ({ name }),
      union: (name) => ({ name }),
      load: (lib) => {
        if (lib === "user32.dll") return { func: user32Funcs };
        return { func: () => () => 0 };
      },
      sizeof: () => 40,
    };
  }
  return load.apply(this, arguments);
};

async function importInputModule() {
  const url = new URL("../dist/main/main/input-injection.js", import.meta.url);
  url.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  return import(url.href);
}

function resetSendInputMock() {
  sendInputMock = { calls: [], failNext: false };
}

test("getInjectorStatus exposes ok/error/platform after init", { concurrency: false }, async () => {
  const { getInjectorStatus, initInputInjector } = await importInputModule();
  initInputInjector();
  const status = getInjectorStatus();
  assert.equal(typeof status.ok, "boolean");
  assert.equal(typeof status.error, "string");
  assert.equal(status.platform, process.platform);
});

test("non-win32: init is noop and injectInput does not throw", { concurrency: false }, async () => {
  if (process.platform === "win32") return;
  resetSendInputMock();
  const { initInputInjector, injectInput, getInjectorStatus } = await importInputModule();
  initInputInjector();
  const status = getInjectorStatus();
  assert.equal(status.ok, true);
  assert.equal(status.error, "");
  injectInput({ kind: "mousemove", x: 0.5, y: 0.5 });
  injectInput({ kind: "mousedown", button: "left" });
  injectInput({ kind: "keydown", code: "KeyA", key: "a" });
  assert.equal(sendInputMock.calls.length, 0);
});

test("win32 mocked: absolute mousemove maps normalized coords to SendInput", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetSendInputMock();

  const { initInputInjector, injectInput } = await importInputModule();
  initInputInjector();

  injectInput({ kind: "mousemove", x: 0.5, y: 0.25 });
  assert.equal(sendInputMock.calls.length, 1);
  const input = sendInputMock.calls[0].inputs[0];
  assert.equal(input.type, 0);
  assert.equal(input.u.mi.dx, Math.round(0.5 * 65535));
  assert.equal(input.u.mi.dy, Math.round(0.25 * 65535));
  assert.ok(input.u.mi.dwFlags & 0x8000);

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32 mocked: relative mousemove clamps deltas", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetSendInputMock();

  const { initInputInjector, injectInput } = await importInputModule();
  initInputInjector();

  injectInput({ kind: "mousemove", x: 5000, y: -5000, mode: "relative" });
  assert.equal(sendInputMock.calls.length, 1);
  assert.equal(sendInputMock.calls[0].inputs[0].u.mi.dx, 4096);
  assert.equal(sendInputMock.calls[0].inputs[0].u.mi.dy, -4096);

  resetSendInputMock();
  const mod2 = await importInputModule();
  mod2.initInputInjector();
  mod2.injectInput({ kind: "mousemove", x: 0, y: 0, mode: "relative" });
  assert.equal(sendInputMock.calls.length, 0);

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32 mocked: mouse buttons and wheel", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetSendInputMock();

  const { initInputInjector, injectInput } = await importInputModule();
  initInputInjector();

  injectInput({ kind: "mousedown", button: "left" });
  injectInput({ kind: "mouseup", button: "right" });
  injectInput({ kind: "wheel", deltaY: 120 });

  assert.equal(sendInputMock.calls.length, 3);
  assert.equal(sendInputMock.calls[0].inputs[0].u.mi.dwFlags, 0x0002);
  assert.equal(sendInputMock.calls[1].inputs[0].u.mi.dwFlags, 0x0010);
  assert.equal(sendInputMock.calls[2].inputs[0].u.mi.mouseData, -120);

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32 mocked: keyboard KeyA and ArrowUp with extended flag", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetSendInputMock();

  const { initInputInjector, injectInput } = await importInputModule();
  initInputInjector();

  injectInput({ kind: "keydown", code: "KeyA", key: "a" });
  injectInput({ kind: "keyup", code: "ArrowUp", key: "ArrowUp" });

  assert.equal(sendInputMock.calls.length, 2);
  assert.equal(sendInputMock.calls[0].inputs[0].type, 1);
  assert.equal(sendInputMock.calls[0].inputs[0].u.ki.wVk, 0x41);
  assert.equal(sendInputMock.calls[1].inputs[0].u.ki.wVk, 0x26);
  assert.ok(sendInputMock.calls[1].inputs[0].u.ki.dwFlags & 0x0002);
  assert.ok(sendInputMock.calls[1].inputs[0].u.ki.dwFlags & 0x0001);

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32 mocked: unknown key code is ignored", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetSendInputMock();

  const { initInputInjector, injectInput } = await importInputModule();
  initInputInjector();
  injectInput({ kind: "keydown", code: "Unmapped", key: "§" });
  assert.equal(sendInputMock.calls.length, 0);

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32 mocked: koffi init failure sets Russian error status", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });

  const origLoad = Module._load;
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
      throw new Error("koffi missing");
    }
    return origLoad.apply(this, arguments);
  };

  const { initInputInjector, getInjectorStatus } = await importInputModule();
  initInputInjector();
  const status = getInjectorStatus();
  assert.equal(status.ok, false);
  assert.match(status.error, /Модуль управления/);
  assert.match(status.error, /koffi missing/);

  Module._load = origLoad;
  Object.defineProperty(process, "platform", { value: origPlatform });
});
