// Unit tests for ViGEm virtual gamepad injection (gamepad-injection.ts).
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

let userDataDir = mkdtempSync(path.join(tmpdir(), "gamepad-injection-"));

const load = Module._load;
const electronMock = function (request, parent, isMain) {
  if (request === "electron") {
    return {
      app: {
        getPath: () => userDataDir,
        getAppPath: () => userDataDir,
      },
    };
  }
  return load.apply(this, arguments);
};

Module._load = electronMock;

async function importGamepadInjection() {
  const url = new URL("../dist/main/main/gamepad-injection.js", import.meta.url);
  url.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  return import(url.href);
}

const focusGuard = await import("../dist/main/main/focus-guard.js");

beforeEach(() => {
  focusGuard.clearAllowedTarget();
  focusGuard.setInputBlocked(false);
});

test("getGamepadInjectorStatus returns disconnected copy with current platform", async () => {
  const { getGamepadInjectorStatus } = await importGamepadInjection();
  const a = getGamepadInjectorStatus();
  const b = getGamepadInjectorStatus();

  assert.notEqual(a, b);
  assert.deepEqual(a, b);
  assert.equal(a.connected, false);
  assert.equal(a.platform, process.platform);
  assert.equal(a.ok, true);
  assert.equal(a.error, "");
});

test("connectGamepad on non-Windows uses noop backend", async () => {
  if (process.platform === "win32") return;

  const { connectGamepad, getGamepadInjectorStatus } = await importGamepadInjection();
  assert.equal(connectGamepad(), false);

  const status = getGamepadInjectorStatus();
  assert.equal(status.connected, false);
  assert.equal(status.ok, true);
});

test("injectGamepad accepts GamepadState without throwing", async () => {
  const { injectGamepad } = await importGamepadInjection();
  assert.doesNotThrow(() =>
    injectGamepad({
      axes: [1, -1, 0.5, -0.5],
      buttons: [1, 0, 1, 0, 0, 0, 1, 1, 0, 1],
    }),
  );
});

test("injectGamepad respects focus guard panic block", async () => {
  focusGuard.setInputBlocked(true);
  const { injectGamepad } = await importGamepadInjection();
  assert.doesNotThrow(() =>
    injectGamepad({
      axes: [0, 0, 0, 0],
      buttons: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    }),
  );
});

test("disconnectGamepad and destroyGamepadInjector are idempotent", async () => {
  const { disconnectGamepad, destroyGamepadInjector } = await importGamepadInjection();
  assert.doesNotThrow(() => {
    disconnectGamepad();
    disconnectGamepad();
    destroyGamepadInjector();
    destroyGamepadInjector();
  });
});
