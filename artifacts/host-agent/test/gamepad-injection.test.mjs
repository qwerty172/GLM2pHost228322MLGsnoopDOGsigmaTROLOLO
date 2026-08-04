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

const {
  getGamepadInjectorStatus,
  initGamepadInjector,
  connectGamepad,
  disconnectGamepad,
  injectGamepad,
  destroyGamepadInjector,
} = await importGamepadInjection();

beforeEach(() => {
  destroyGamepadInjector();
});

test("getGamepadInjectorStatus returns disconnected snapshot", () => {
  const status = getGamepadInjectorStatus();
  assert.equal(status.connected, false);
  assert.equal(status.platform, process.platform);
  assert.equal(typeof status.ok, "boolean");
  assert.equal(typeof status.error, "string");
});

test("initGamepadInjector on non-Windows uses noop backend", () => {
  if (process.platform === "win32") return;

  initGamepadInjector();
  const status = getGamepadInjectorStatus();
  assert.equal(status.connected, false);
  assert.equal(connectGamepad(), false);
});

test("injectGamepad on non-Windows does not throw", () => {
  if (process.platform === "win32") return;

  injectGamepad({
    axes: [0.5, -0.25, 1, -1],
    buttons: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
  });
  assert.equal(getGamepadInjectorStatus().connected, false);
});

test("disconnectGamepad and destroyGamepadInjector are idempotent", () => {
  disconnectGamepad();
  destroyGamepadInjector();
  destroyGamepadInjector();
  assert.equal(getGamepadInjectorStatus().connected, false);
});

function withPlatform(platform, fn) {
  const orig = process.platform;
  Object.defineProperty(process, "platform", { value: platform, configurable: true });
  return Promise.resolve(fn()).finally(() => {
    Object.defineProperty(process, "platform", { value: orig, configurable: true });
  });
}

function patchModuleLoad(patches) {
  const origLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request in patches) return patches[request]();
    if (request === "electron") {
      return { app: { getAppPath: () => "/tmp/test-agent" } };
    }
    return origLoad.apply(this, arguments);
  };
  return () => {
    Module._load = origLoad;
  };
}

test("win32 init failure reports unavailable gamepad status", async () => {
  if (process.platform === "win32") return;

  const restoreLoad = patchModuleLoad({
    koffi: () => ({
      struct: () => ({}),
      load: () => {
        throw new Error("mock koffi load failure");
      },
    }),
  });

  try {
    await withPlatform("win32", async () => {
      const mod = await importGamepadInjection();
      mod.initGamepadInjector();
      const status = mod.getGamepadInjectorStatus();
      assert.equal(status.ok, false);
      assert.match(status.error, /ViGEmClient\.dll/i);
      assert.equal(status.connected, false);
      assert.equal(mod.connectGamepad(), false);
    });
  } finally {
    restoreLoad();
  }
});

test("win32 with mocked ViGEm connects and forwards gamepad state", async () => {
  if (process.platform === "win32") return;

  const reports = [];
  const restoreLoad = patchModuleLoad({
    koffi: () => ({
      struct: () => ({}),
      load: () => ({
        func: (sig) => {
          if (sig.includes("vigem_alloc")) return () => ({});
          if (sig.includes("vigem_free")) return () => {};
          if (sig.includes("vigem_connect")) return () => 0;
          if (sig.includes("vigem_disconnect")) return () => {};
          if (sig.includes("vigem_target_x360_alloc")) return () => ({});
          if (sig.includes("vigem_target_free")) return () => {};
          if (sig.includes("vigem_target_add")) return () => 0;
          if (sig.includes("vigem_target_remove")) return () => 0;
          if (sig.includes("vigem_target_x360_update")) {
            return (_client, _target, report) => {
              reports.push({ ...report });
              return 0;
            };
          }
          return () => 0;
        },
      }),
    }),
  });

  try {
    await withPlatform("win32", async () => {
      const mod = await importGamepadInjection();
      mod.initGamepadInjector();
      assert.equal(mod.connectGamepad(), true);
      assert.equal(mod.getGamepadInjectorStatus().connected, true);

      mod.injectGamepad({
        axes: [1, -1, 0.5, -0.5],
        buttons: [1, 0, 1, 0, 0, 0, 1, 1, 1, 1],
      });

      assert.equal(reports.length, 1);
      const report = reports[0];
      assert.equal(report.wButtons & 0x1000, 0x1000); // A
      assert.equal(report.wButtons & 0x4000, 0x4000); // X
      assert.equal(report.bLeftTrigger, 255);
      assert.equal(report.bRightTrigger, 255);
      assert.equal(report.sThumbLX, 32767);
      assert.equal(report.sThumbLY, 32767); // Y inverted
      assert.equal(report.sThumbRX, 16384);
      assert.equal(report.sThumbRY, 16384);

      mod.destroyGamepadInjector();
      assert.equal(mod.getGamepadInjectorStatus().connected, false);
    });
  } finally {
    restoreLoad();
  }
});
