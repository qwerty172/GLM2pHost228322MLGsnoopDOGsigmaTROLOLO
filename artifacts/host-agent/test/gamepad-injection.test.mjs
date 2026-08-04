// Unit tests for ViGEm virtual gamepad injection (gamepad-injection.ts).
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const gamepadPath = require.resolve("../dist/main/main/gamepad-injection.js");
const load = Module._load;
const electronMock = { app: { getAppPath: () => "/tmp/test-agent" } };

function mockElectron() {
  Module._load = function (request, parent, isMain) {
    if (request === "electron") return electronMock;
    return load.apply(this, arguments);
  };
}

function loadGamepadModule() {
  delete require.cache[gamepadPath];
  mockElectron();
  return require(gamepadPath);
}

const {
  getGamepadInjectorStatus,
  connectGamepad,
  disconnectGamepad,
  injectGamepad,
  destroyGamepadInjector,
} = loadGamepadModule();
const { clearAllowedTarget, setInputBlocked } = await import(
  "../dist/main/main/focus-guard.js"
);

beforeEach(() => {
  destroyGamepadInjector();
  clearAllowedTarget();
  setInputBlocked(false);
});

test("getGamepadInjectorStatus returns disconnected on non-Windows", () => {
  const status = getGamepadInjectorStatus();
  assert.equal(status.ok, true);
  assert.equal(status.connected, false);
  assert.equal(status.error, "");
  assert.equal(status.platform, process.platform);
});

test("connectGamepad returns false on non-Windows (noop backend)", () => {
  assert.equal(connectGamepad(), false);
  assert.equal(getGamepadInjectorStatus().connected, false);
});

test("injectGamepad does not throw on non-Windows", () => {
  injectGamepad({
    axes: [0.5, -0.25, 0, 0],
    buttons: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  });
  assert.equal(getGamepadInjectorStatus().connected, false);
});

test("disconnectGamepad and destroyGamepadInjector are safe when idle", () => {
  disconnectGamepad();
  destroyGamepadInjector();
  assert.equal(getGamepadInjectorStatus().connected, false);
});

test("injectGamepad skips when focus guard blocks input", () => {
  setInputBlocked(true);
  injectGamepad({
    axes: [0, 0, 0, 0],
    buttons: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  });
  assert.equal(connectGamepad(), false);
});

test("win32 mocked ViGEm: connect and XUSB report mapping", async () => {
  let lastReport = null;
  let connectCalls = 0;
  const origPlatform = process.platform;

  Object.defineProperty(process, "platform", {
    configurable: true,
    get: () => "win32",
  });

  Module._load = function (request, parent, isMain) {
    if (request === "electron") return electronMock;
    if (request === "koffi") {
      return {
        struct: (name) => name,
        load: () => ({
          func: (sig) => {
            if (sig.includes("vigem_alloc")) return () => ({ client: 1 });
            if (sig.includes("vigem_connect")) {
              return () => {
                connectCalls += 1;
                return 0;
              };
            }
            if (sig.includes("vigem_target_x360_alloc")) return () => ({ target: 2 });
            if (sig.includes("vigem_target_add")) return () => 0;
            if (sig.includes("vigem_target_x360_update")) {
              return (_client, _target, report) => {
                lastReport = report;
                return 0;
              };
            }
            return () => {};
          },
        }),
      };
    }
    return load.apply(this, arguments);
  };

  delete require.cache[gamepadPath];
  const win = require(gamepadPath);

  assert.equal(win.connectGamepad(), true);
  const status = win.getGamepadInjectorStatus();
  assert.equal(status.ok, true);
  assert.equal(status.connected, true);

  win.injectGamepad({
    axes: [1, 1, -1, -1],
    buttons: [1, 1, 0, 1, 1, 1, 1, 1, 0, 0],
  });

  assert.ok(lastReport);
  assert.equal(
    lastReport.wButtons,
    0x1000 | 0x2000 | 0x8000 | 0x0100 | 0x0200,
  );
  assert.equal(lastReport.bLeftTrigger, 255);
  assert.equal(lastReport.bRightTrigger, 255);
  assert.equal(lastReport.sThumbLX, 32767);
  assert.equal(lastReport.sThumbLY, -32767);
  assert.equal(lastReport.sThumbRX, -32767);
  assert.equal(lastReport.sThumbRY, 32767);
  assert.equal(connectCalls, 1);

  win.destroyGamepadInjector();
  assert.equal(win.getGamepadInjectorStatus().connected, false);

  Object.defineProperty(process, "platform", {
    configurable: true,
    value: origPlatform,
  });
  mockElectron();
});
