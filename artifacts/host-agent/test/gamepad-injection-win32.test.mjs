// ViGEm / stateToReport path — isolated import with win32 + koffi mocks.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";

const reports = [];

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return { app: { getAppPath: () => "/tmp/test-agent" } };
  }
  if (request === "koffi") {
    return {
      struct: () => ({}),
      load: () => ({
        func: (sig) => {
          if (sig.includes("vigem_alloc")) return () => ({ ptr: 1 });
          if (sig.includes("vigem_free")) return () => {};
          if (sig.includes("vigem_connect")) return () => 0;
          if (sig.includes("vigem_disconnect")) return () => {};
          if (sig.includes("vigem_target_x360_alloc")) return () => ({ ptr: 2 });
          if (sig.includes("vigem_target_free")) return () => {};
          if (sig.includes("vigem_target_add")) return () => 0;
          if (sig.includes("vigem_target_remove")) return () => 0;
          if (sig.includes("vigem_target_x360_update")) {
            return (_client, _target, report) => {
              reports.push(report);
              return 0;
            };
          }
          return () => 0;
        },
      }),
    };
  }
  return load.apply(this, arguments);
};

Object.defineProperty(process, "platform", { value: "win32" });

const {
  initGamepadInjector,
  connectGamepad,
  injectGamepad,
  getGamepadInjectorStatus,
  destroyGamepadInjector,
} = await import("../dist/main/main/gamepad-injection.js");
const { setInputBlocked, clearAllowedTarget } = await import(
  "../dist/main/main/focus-guard.js",
);

beforeEach(() => {
  reports.length = 0;
  clearAllowedTarget();
  setInputBlocked(false);
  destroyGamepadInjector();
});

test("connectGamepad succeeds with mocked ViGEm", () => {
  initGamepadInjector();
  assert.equal(connectGamepad(), true);
  const status = getGamepadInjectorStatus();
  assert.equal(status.ok, true);
  assert.equal(status.connected, true);
  assert.equal(status.error, "");
});

test("injectGamepad maps buttons, triggers and stick axes to XUSB report", () => {
  initGamepadInjector();
  connectGamepad();
  injectGamepad({
    axes: [1, -1, 0.5, -0.5],
    buttons: [1, 0, 1, 0, 1, 0, 1, 1, 0, 1],
  });
  assert.equal(reports.length, 1);
  const report = reports[0];
  assert.equal(report.wButtons, 0x1000 | 0x4000 | 0x0100 | 0x0010);
  assert.equal(report.bLeftTrigger, 255);
  assert.equal(report.bRightTrigger, 255);
  assert.equal(report.sThumbLX, 32767);
  assert.equal(report.sThumbLY, 32767);
  assert.equal(report.sThumbRX, Math.round(0.5 * 32767));
  assert.equal(report.sThumbRY, Math.round(0.5 * 32767));
});

test("injectGamepad clamps stick axes to [-1, 1]", () => {
  initGamepadInjector();
  connectGamepad();
  injectGamepad({
    axes: [99, -99, 0, 0],
    buttons: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  });
  assert.equal(reports.length, 1);
  assert.equal(reports[0].sThumbLX, 32767);
  assert.equal(reports[0].sThumbLY, 32767);
});
