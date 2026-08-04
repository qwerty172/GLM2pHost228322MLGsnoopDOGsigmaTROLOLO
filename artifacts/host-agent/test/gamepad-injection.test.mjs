// Unit tests for virtual Xbox 360 gamepad injection (gamepad-injection.ts).
import { test, beforeEach, describe } from "node:test";
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
  getGamepadInjectorStatus,
  connectGamepad,
  disconnectGamepad,
  injectGamepad,
  destroyGamepadInjector,
} = await import("../dist/main/main/gamepad-injection.js");

const { setInputBlocked, clearAllowedTarget } = await import(
  "../dist/main/main/focus-guard.js"
);

describe("gamepad-injection", { concurrency: false }, () => {
  beforeEach(() => {
    clearAllowedTarget();
    setInputBlocked(false);
    destroyGamepadInjector();
  });

  test("getGamepadInjectorStatus returns a snapshot with platform fields", () => {
    const status = getGamepadInjectorStatus();
    assert.equal(status.platform, process.platform);
    assert.equal(typeof status.ok, "boolean");
    assert.equal(typeof status.error, "string");
    assert.equal(typeof status.connected, "boolean");
    status.connected = true;
    assert.notEqual(getGamepadInjectorStatus().connected, true);
  });

  test("connectGamepad returns false on non-Windows", () => {
    if (process.platform === "win32") return;
    assert.equal(connectGamepad(), false);
    assert.equal(getGamepadInjectorStatus().connected, false);
  });

  test("injectGamepad accepts a full gamepad state without throwing", () => {
    assert.doesNotThrow(() =>
      injectGamepad({
        axes: [0.5, -0.5, 1, -1],
        buttons: [1, 0, 1, 0, 1, 0, 1, 1, 0, 1],
      }),
    );
  });

  test("injectGamepad is a no-op when focus guard blocks input", () => {
    setInputBlocked(true);
    assert.doesNotThrow(() =>
      injectGamepad({ axes: [0, 0, 0, 0], buttons: [1, 1, 1, 1, 0, 0, 0, 0, 0, 0] }),
    );
    assert.equal(getGamepadInjectorStatus().connected, false);
  });

  test("disconnectGamepad and destroyGamepadInjector are safe when idle", () => {
    assert.doesNotThrow(() => {
      disconnectGamepad();
      destroyGamepadInjector();
      destroyGamepadInjector();
    });
  });
});
