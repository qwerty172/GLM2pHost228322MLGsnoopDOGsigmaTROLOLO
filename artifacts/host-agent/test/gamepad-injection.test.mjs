// Unit tests for virtual Xbox 360 gamepad injection (gamepad-injection.ts).
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const appPath = mkdtempSync(path.join(tmpdir(), "gamepad-agent-"));
const dllDir = mkdtempSync(path.join(tmpdir(), "gamepad-dll-"));
const fakeDll = path.join(dllDir, "ViGEmClient.dll");
writeFileSync(fakeDll, "fake");

let lastReport = null;
let updateCallCount = 0;

function createMockKoffi() {
  return {
    struct: () => ({}),
    load: () => ({
      func: (sig) => {
        if (sig.includes("vigem_target_x360_update")) {
          return (_client, _target, report) => {
            lastReport = { ...report };
            updateCallCount += 1;
            return 0;
          };
        }
        if (sig.includes("vigem_alloc") || sig.includes("vigem_target_x360_alloc")) {
          return () => ({});
        }
        if (sig.includes("vigem_connect") || sig.includes("vigem_target_add")) {
          return () => 0;
        }
        return () => {};
      },
    }),
  };
}

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return {
      app: {
        getAppPath: () => appPath,
        getPath: () => appPath,
      },
    };
  }
  if (request === "koffi") {
    return createMockKoffi();
  }
  if (request === "node:fs") {
    const realFs = load.apply(this, arguments);
    return {
      ...realFs,
      existsSync: (p) => p === fakeDll || realFs.existsSync(p),
    };
  }
  return load.apply(this, arguments);
};

async function importGamepad() {
  lastReport = null;
  updateCallCount = 0;

  const url = new URL("../dist/main/main/gamepad-injection.js", import.meta.url);
  url.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  return import(url.href);
}

function withPlatform(platform, fn) {
  const orig = process.platform;
  Object.defineProperty(process, "platform", { value: platform, configurable: true });
  try {
    return fn();
  } finally {
    Object.defineProperty(process, "platform", { value: orig, configurable: true });
  }
}

beforeEach(() => {
  lastReport = null;
  updateCallCount = 0;
});

test("getGamepadInjectorStatus returns platform and disconnected state on non-Windows", async () => {
  if (process.platform === "win32") return;

  const { getGamepadInjectorStatus, initGamepadInjector } = await importGamepad();
  initGamepadInjector();
  const status = getGamepadInjectorStatus();

  assert.equal(status.platform, process.platform);
  assert.equal(status.connected, false);
  assert.equal(status.ok, true);
});

test("connectGamepad returns false on non-Windows (noop backend)", async () => {
  if (process.platform === "win32") return;

  const { connectGamepad, getGamepadInjectorStatus } = await importGamepad();
  assert.equal(connectGamepad(), false);
  assert.equal(getGamepadInjectorStatus().connected, false);
});

test("injectGamepad and destroyGamepadInjector do not throw on non-Windows", async () => {
  if (process.platform === "win32") return;

  const { injectGamepad, destroyGamepadInjector } = await importGamepad();
  assert.doesNotThrow(() => {
    injectGamepad({ axes: [0, 0, 0, 0], buttons: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] });
    destroyGamepadInjector();
  });
});

test("initGamepadInjector loads ViGEm and connectGamepad succeeds on Windows", async () => {
  process.resourcesPath = dllDir;
  const {
    initGamepadInjector,
    connectGamepad,
    getGamepadInjectorStatus,
    destroyGamepadInjector,
  } = await importGamepad();

  withPlatform("win32", () => {
    initGamepadInjector();
    assert.equal(connectGamepad(), true);

    const status = getGamepadInjectorStatus();
    assert.equal(status.ok, true);
    assert.equal(status.connected, true);
    assert.equal(status.error, "");

    destroyGamepadInjector();
    assert.equal(getGamepadInjectorStatus().connected, false);
  });
});

test("injectGamepad maps buttons and axes to XUSB report on Windows", async () => {
  process.resourcesPath = dllDir;
  const { injectGamepad, connectGamepad, destroyGamepadInjector } = await importGamepad();

  withPlatform("win32", () => {
    connectGamepad();
    injectGamepad({
      axes: [1, -1, 0.5, -0.5],
      buttons: [1, 0, 1, 0, 1, 0, 1, 1, 0, 1],
    });

    assert.equal(updateCallCount, 1);
    assert.ok(lastReport);
    assert.equal(lastReport.wButtons, 0x1000 | 0x4000 | 0x0100 | 0x0010); // A + X + LB + Start
    assert.equal(lastReport.bLeftTrigger, 255);
    assert.equal(lastReport.bRightTrigger, 255);
    assert.equal(lastReport.sThumbLX, 32767);
    assert.equal(lastReport.sThumbLY, 32767); // Y inverted
    assert.equal(lastReport.sThumbRX, 16384);
    assert.equal(lastReport.sThumbRY, 16384); // RY inverted, Math.round(0.5 * 32767)

    destroyGamepadInjector();
  });
});

test("initGamepadInjector reports error when koffi fails to load ViGEm on Windows", async () => {
  const origLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === "koffi") {
      throw new Error("koffi load failed");
    }
    return origLoad.apply(this, arguments);
  };

  try {
    const { initGamepadInjector, getGamepadInjectorStatus } = await importGamepad();

    withPlatform("win32", () => {
      initGamepadInjector();
      const status = getGamepadInjectorStatus();

      assert.equal(status.ok, false);
      assert.equal(status.connected, false);
      assert.match(status.error, /Не удалось загрузить ViGEmClient\.dll/);
    });
  } finally {
    Module._load = origLoad;
  }
});
