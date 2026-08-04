// Unit tests for virtual Xbox 360 gamepad injection (gamepad-injection.ts).
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";

const load = Module._load;

function mockElectron() {
  Module._load = function (request, parent, isMain) {
    if (request === "electron") {
      return { app: { getAppPath: () => "/tmp/test-agent" } };
    }
    return load.apply(this, arguments);
  };
}

async function importGamepadInjection() {
  const url = new URL("../dist/main/main/gamepad-injection.js", import.meta.url);
  url.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  return import(url.href);
}

const originalPlatform = process.platform;

function mockWin32Platform() {
  Object.defineProperty(process, "platform", { value: "win32", configurable: true });
}

function restorePlatform() {
  Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
}

function mockKoffiBackend() {
  const updates = [];
  Module._load = function (request, parent, isMain) {
    if (request === "electron") {
      return { app: { getAppPath: () => "/tmp/test-agent" } };
    }
    if (request === "koffi") {
      return {
        struct: () => ({}),
        load: () => ({
          func: (sig) => {
            if (sig.includes("vigem_alloc")) return () => ({ client: 1 });
            if (sig.includes("vigem_connect")) return () => 0;
            if (sig.includes("vigem_target_x360_alloc")) return () => ({ target: 1 });
            if (sig.includes("vigem_target_add")) return () => 0;
            if (sig.includes("vigem_target_x360_update")) {
              return (client, target, report) => {
                updates.push(report);
                return 0;
              };
            }
            if (sig.includes("vigem_target_remove")) return () => 0;
            if (sig.includes("vigem_disconnect")) return () => {};
            if (sig.includes("vigem_target_free")) return () => {};
            if (sig.includes("vigem_free")) return () => {};
            return () => {};
          },
        }),
      };
    }
    if (request === "node:fs") {
      const actual = load.apply(this, arguments);
      return {
        ...actual,
        existsSync: (p) => p === "ViGEmClient.dll" || actual.existsSync(p),
      };
    }
    return load.apply(this, arguments);
  };
  return updates;
}

mockElectron();

const {
  getGamepadInjectorStatus,
  initGamepadInjector,
  connectGamepad,
  disconnectGamepad,
  injectGamepad,
  destroyGamepadInjector,
} = await importGamepadInjection();

beforeEach(() => {
  disconnectGamepad();
});

test("getGamepadInjectorStatus returns disconnected initial state", () => {
  const st = getGamepadInjectorStatus();
  assert.equal(st.connected, false);
  assert.equal(st.platform, process.platform);
  assert.equal(typeof st.ok, "boolean");
});

test("initGamepadInjector on non-Windows uses noop backend", () => {
  if (process.platform === "win32") return;
  initGamepadInjector();
  assert.equal(connectGamepad(), false);
  const st = getGamepadInjectorStatus();
  assert.equal(st.connected, false);
});

test("injectGamepad does not throw on non-Windows", () => {
  if (process.platform === "win32") return;
  assert.doesNotThrow(() =>
    injectGamepad({ axes: [0, 0, 0, 0], buttons: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }),
  );
});

test("destroyGamepadInjector is safe to call repeatedly", () => {
  assert.doesNotThrow(() => {
    destroyGamepadInjector();
    destroyGamepadInjector();
  });
});

test("win32 without ViGEm DLL reports error status", async () => {
  if (process.platform === "win32") return;
  mockWin32Platform();
  Module._load = function (request, parent, isMain) {
    if (request === "electron") {
      return { app: { getAppPath: () => "/tmp/test-agent" } };
    }
    if (request === "node:fs") {
      const actual = load.apply(this, arguments);
      return { ...actual, existsSync: () => false };
    }
    return load.apply(this, arguments);
  };

  const mod = await importGamepadInjection();
  mod.initGamepadInjector();
  const st = mod.getGamepadInjectorStatus();
  assert.equal(st.ok, false);
  assert.match(st.error, /ViGEmClient\.dll/);
  assert.equal(st.connected, false);
  assert.equal(mod.connectGamepad(), false);
  restorePlatform();
  mockElectron();
});

test("win32 with mocked ViGEm connects and maps gamepad state", async () => {
  if (process.platform === "win32") return;
  mockWin32Platform();
  const updates = mockKoffiBackend();

  const mod = await importGamepadInjection();
  mod.initGamepadInjector();
  assert.equal(mod.connectGamepad(), true);

  const st = mod.getGamepadInjectorStatus();
  assert.equal(st.ok, true);
  assert.equal(st.connected, true);

  mod.injectGamepad({
    axes: [1, -1, 0.5, -0.5],
    buttons: [1, 0, 1, 0, 1, 0, 1, 1, 0, 1],
  });

  assert.equal(updates.length, 1);
  const report = updates[0];
  assert.equal(report.wButtons & 0x1000, 0x1000); // A
  assert.equal(report.wButtons & 0x4000, 0x4000); // X
  assert.equal(report.wButtons & 0x0100, 0x0100); // LB
  assert.equal(report.bLeftTrigger, 255);
  assert.equal(report.bRightTrigger, 255);
  assert.equal(report.sThumbLX, 32767);
  assert.equal(report.sThumbLY, 32767); // Y inverted
  assert.equal(report.sThumbRX, 16384);
  assert.equal(report.sThumbRY, 16384); // RY inverted

  mod.disconnectGamepad();
  assert.equal(mod.getGamepadInjectorStatus().connected, false);
  restorePlatform();
  mockElectron();
});

test("win32 connect failure sets ViGEmBus error", async () => {
  if (process.platform === "win32") return;
  mockWin32Platform();
  Module._load = function (request, parent, isMain) {
    if (request === "electron") {
      return { app: { getAppPath: () => "/tmp/test-agent" } };
    }
    if (request === "koffi") {
      return {
        struct: () => ({}),
        load: () => ({
          func: (sig) => {
            if (sig.includes("vigem_alloc")) return () => ({ client: 1 });
            if (sig.includes("vigem_connect")) return () => -1;
            return () => {};
          },
        }),
      };
    }
    if (request === "node:fs") {
      const actual = load.apply(this, arguments);
      return { ...actual, existsSync: (p) => p === "ViGEmClient.dll" };
    }
    return load.apply(this, arguments);
  };

  const mod = await importGamepadInjection();
  mod.initGamepadInjector();
  assert.equal(mod.connectGamepad(), false);
  const st = mod.getGamepadInjectorStatus();
  assert.equal(st.ok, false);
  assert.match(st.error, /ViGEmBus/);
  restorePlatform();
  mockElectron();
});
