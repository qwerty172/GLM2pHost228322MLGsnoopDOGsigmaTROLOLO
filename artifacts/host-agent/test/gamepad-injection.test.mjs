// Unit tests for virtual Xbox 360 gamepad injection (gamepad-injection.ts).
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

async function importGamepadInjection() {
  const url = new URL("../dist/main/main/gamepad-injection.js", import.meta.url);
  url.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  return import(url.href);
}

function sampleState(overrides = {}) {
  return {
    axes: [0, 0, 0, 0],
    buttons: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ...overrides,
  };
}

beforeEach(async () => {
  const { destroyGamepadInjector } = await importGamepadInjection();
  destroyGamepadInjector();
  const focusGuard = await import("../dist/main/main/focus-guard.js");
  focusGuard.clearAllowedTarget();
  focusGuard.setInputBlocked(false);
});

test("getGamepadInjectorStatus returns a shallow copy", async () => {
  const { getGamepadInjectorStatus, initGamepadInjector } = await importGamepadInjection();
  initGamepadInjector();
  const first = getGamepadInjectorStatus();
  const second = getGamepadInjectorStatus();
  assert.notEqual(first, second);
  assert.equal(first.platform, process.platform);
  assert.equal(typeof first.ok, "boolean");
  assert.equal(typeof first.connected, "boolean");
});

test("non-win32 init uses noop backend and connect returns false", async () => {
  if (process.platform === "win32") return;

  const { initGamepadInjector, connectGamepad, getGamepadInjectorStatus } =
    await importGamepadInjection();

  initGamepadInjector();
  assert.equal(connectGamepad(), false);

  const status = getGamepadInjectorStatus();
  assert.equal(status.ok, true);
  assert.equal(status.connected, false);
  assert.equal(status.error, "");
});

test("injectGamepad and destroyGamepadInjector are safe on noop backend", async () => {
  const { injectGamepad, destroyGamepadInjector } = await importGamepadInjection();

  injectGamepad(
    sampleState({
      axes: [1, -1, 0.5, -0.5],
      buttons: [1, 0, 0, 0, 1, 0, 1, 0, 0, 1],
    }),
  );

  assert.doesNotThrow(() => destroyGamepadInjector());
  assert.doesNotThrow(() => destroyGamepadInjector());
});

test("injectGamepad skips injection when focus guard blocks input", async () => {
  const focusGuard = await import("../dist/main/main/focus-guard.js");
  const { injectGamepad, getGamepadInjectorStatus } = await importGamepadInjection();

  focusGuard.setInputBlocked(true);
  injectGamepad(sampleState({ buttons: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0] }));

  assert.equal(getGamepadInjectorStatus().connected, false);
  focusGuard.setInputBlocked(false);
});
