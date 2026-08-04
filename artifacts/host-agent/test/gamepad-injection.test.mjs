import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";

/** Mutable ViGEm mock state for win32 + koffi tests. */
let vigemMock = {
  connectResult: 0,
  addResult: 0,
  allocClient: { mock: "client" },
  allocTarget: { mock: "target" },
  updateCalls: [],
  disconnectCalls: 0,
};

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return {
      app: {
        getAppPath: () => "/tmp/test-gamepad-agent",
        getPath: () => "/tmp/test-gamepad-agent",
      },
    };
  }
  if (request === "koffi") {
    const vigemFuncs = (sig) => {
      if (sig.includes("vigem_alloc")) {
        return () => vigemMock.allocClient;
      }
      if (sig.includes("vigem_connect")) {
        return () => vigemMock.connectResult;
      }
      if (sig.includes("vigem_target_x360_alloc")) {
        return () => vigemMock.allocTarget;
      }
      if (sig.includes("vigem_target_add")) {
        return () => vigemMock.addResult;
      }
      if (sig.includes("vigem_target_x360_update")) {
        return (_client, _target, report) => {
          vigemMock.updateCalls.push(report);
          return 0;
        };
      }
      if (sig.includes("vigem_disconnect")) {
        return () => {
          vigemMock.disconnectCalls += 1;
        };
      }
      if (sig.includes("vigem_free")) return () => {};
      if (sig.includes("vigem_target_free")) return () => {};
      if (sig.includes("vigem_target_remove")) return () => 0;
      return () => {};
    };
    return {
      struct: () => ({}),
      load: () => ({ func: vigemFuncs }),
    };
  }
  return load.apply(this, arguments);
};

async function importGamepadModule() {
  const url = new URL("../dist/main/main/gamepad-injection.js", import.meta.url);
  url.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  return import(url.href);
}

function resetVigemMock() {
  vigemMock = {
    connectResult: 0,
    addResult: 0,
    allocClient: { mock: "client" },
    allocTarget: { mock: "target" },
    updateCalls: [],
    disconnectCalls: 0,
  };
}

test("getGamepadInjectorStatus returns a defensive copy", async () => {
  const { getGamepadInjectorStatus, initGamepadInjector } = await importGamepadModule();
  initGamepadInjector();
  const status = getGamepadInjectorStatus();
  assert.equal(typeof status.ok, "boolean");
  assert.equal(typeof status.error, "string");
  assert.equal(status.platform, process.platform);
  status.connected = true;
  assert.equal(getGamepadInjectorStatus().connected, false);
});

test("non-win32: init uses noop backend and connect returns false", async () => {
  if (process.platform === "win32") return;
  const { initGamepadInjector, connectGamepad, getGamepadInjectorStatus } =
    await importGamepadModule();
  initGamepadInjector();
  assert.equal(connectGamepad(), false);
  const status = getGamepadInjectorStatus();
  assert.equal(status.ok, true);
  assert.equal(status.connected, false);
});

test("non-win32: injectGamepad does not throw", async () => {
  if (process.platform === "win32") return;
  const { injectGamepad } = await importGamepadModule();
  injectGamepad({
    axes: [1, -1, 0.5, -0.5],
    buttons: [1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
  });
});

test("win32 mocked: connect succeeds and inject maps XUSB report", async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetVigemMock();

  const {
    initGamepadInjector,
    connectGamepad,
    injectGamepad,
    getGamepadInjectorStatus,
    destroyGamepadInjector,
  } = await importGamepadModule();

  initGamepadInjector();
  assert.equal(connectGamepad(), true);
  assert.equal(getGamepadInjectorStatus().connected, true);

  injectGamepad({
    axes: [1, 1, -1, -1],
    buttons: [1, 1, 0, 0, 1, 1, 1, 1, 1, 1],
  });

  assert.equal(vigemMock.updateCalls.length, 1);
  const report = vigemMock.updateCalls[0];
  assert.equal(report.wButtons & 0x1000, 0x1000);
  assert.equal(report.wButtons & 0x2000, 0x2000);
  assert.equal(report.bLeftTrigger, 255);
  assert.equal(report.bRightTrigger, 255);
  assert.equal(report.sThumbLX, 32767);
  assert.equal(report.sThumbLY, -32767);
  assert.equal(report.sThumbRX, -32767);
  assert.equal(report.sThumbRY, 32767);

  destroyGamepadInjector();
  assert.equal(getGamepadInjectorStatus().connected, false);
  assert.ok(vigemMock.disconnectCalls > 0);

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32 mocked: connect failure sets error status", async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetVigemMock();
  vigemMock.connectResult = 1;

  const { initGamepadInjector, connectGamepad, getGamepadInjectorStatus } =
    await importGamepadModule();

  initGamepadInjector();
  assert.equal(connectGamepad(), false);
  const status = getGamepadInjectorStatus();
  assert.equal(status.ok, false);
  assert.equal(status.connected, false);
  assert.match(status.error, /ViGEmBus/i);

  Object.defineProperty(process, "platform", { value: origPlatform });
});
