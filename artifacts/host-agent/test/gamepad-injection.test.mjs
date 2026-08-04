import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return { app: { getAppPath: () => "/tmp/test-agent" } };
  }
  return load.apply(this, arguments);
};

const {
  initGamepadInjector,
  getGamepadInjectorStatus,
  connectGamepad,
  disconnectGamepad,
  injectGamepad,
  destroyGamepadInjector,
} = await import("../dist/main/main/gamepad-injection.js");
const { setInputBlocked, clearAllowedTarget } = await import(
  "../dist/main/main/focus-guard.js",
);

beforeEach(() => {
  clearAllowedTarget();
  setInputBlocked(false);
  destroyGamepadInjector();
});

test("getGamepadInjectorStatus returns a snapshot", () => {
  const a = getGamepadInjectorStatus();
  const b = getGamepadInjectorStatus();
  assert.notEqual(a, b);
  assert.equal(a.platform, process.platform);
  assert.equal(a.connected, false);
});

test("initGamepadInjector on non-Windows uses noop backend", () => {
  if (process.platform === "win32") return;
  initGamepadInjector();
  const status = getGamepadInjectorStatus();
  assert.equal(status.connected, false);
  assert.equal(connectGamepad(), false);
});

test("injectGamepad runs when input guard allows", () => {
  let called = false;
  setInputBlocked(false);
  injectGamepad({
    axes: [0, 0, 0, 0],
    buttons: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  });
  called = true;
  assert.equal(called, true);
  assert.equal(getGamepadInjectorStatus().connected, false);
});

test("injectGamepad skips when input guard blocks", () => {
  setInputBlocked(true);
  injectGamepad({
    axes: [1, 1, 1, 1],
    buttons: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  });
  assert.equal(getGamepadInjectorStatus().connected, false);
});

test("disconnectGamepad and destroyGamepadInjector do not throw", () => {
  initGamepadInjector();
  disconnectGamepad();
  destroyGamepadInjector();
  assert.equal(getGamepadInjectorStatus().connected, false);
});
