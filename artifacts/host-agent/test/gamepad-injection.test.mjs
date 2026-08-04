// Unit tests for ViGEm virtual Xbox 360 gamepad injection (gamepad-injection.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const electronAppPath = mkdtempSync(path.join(tmpdir(), "gamepad-agent-"));
const gamepadModulePath = path.resolve("dist/main/main/gamepad-injection.js");
const gamepadRequire = createRequire(import.meta.url);

const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return {
      app: {
        getPath: () => electronAppPath,
        getAppPath: () => electronAppPath,
      },
    };
  }
  return origLoad.apply(this, arguments);
};

async function withGamepad({ platform, koffiMock }, fn) {
  const origPlatform = process.platform;
  const load = Module._load;

  if (platform && platform !== origPlatform) {
    Object.defineProperty(process, "platform", {
      value: platform,
      configurable: true,
    });
  }

  Module._load = function (request, parent, isMain) {
    if (request === "electron") {
      return {
        app: {
          getPath: () => electronAppPath,
          getAppPath: () => electronAppPath,
        },
      };
    }
    if (request === "koffi" && koffiMock) return koffiMock;
    return load.apply(this, arguments);
  };

  delete gamepadRequire.cache[gamepadModulePath];

  const url = new URL("../dist/main/main/gamepad-injection.js", import.meta.url);
  url.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  const mod = await import(url.href);

  try {
    await fn(mod);
  } finally {
    mod.destroyGamepadInjector?.();
    if (platform && platform !== origPlatform) {
      Object.defineProperty(process, "platform", {
        value: origPlatform,
        configurable: true,
      });
    }
    Module._load = load;
  }
}

function createVigemMock({ connectCode = 0, addCode = 0 } = {}) {
  let lastReport = null;
  const client = { id: "client" };
  const target = { id: "target" };

  const vigemLib = {
    func: (sig) => {
      if (sig.includes("vigem_alloc")) return () => client;
      if (sig.includes("vigem_connect")) return () => connectCode;
      if (sig.includes("vigem_target_x360_alloc")) return () => target;
      if (sig.includes("vigem_target_add")) return () => addCode;
      if (sig.includes("vigem_target_x360_update")) {
        return (_c, _t, report) => {
          lastReport = report;
          return 0;
        };
      }
      if (sig.includes("vigem_target_remove")) return () => 0;
      if (sig.includes("vigem_disconnect")) return () => {};
      if (sig.includes("vigem_free")) return () => {};
      if (sig.includes("vigem_target_free")) return () => {};
      return () => {};
    },
  };

  const mock = {
    load: () => vigemLib,
    struct: () => ({}),
  };

  return {
    mock,
    getLastReport: () => lastReport,
  };
}

test("non-Windows: connectGamepad is a no-op and returns false", async () => {
  await withGamepad({}, async ({
    connectGamepad,
    getGamepadInjectorStatus,
  }) => {
    assert.equal(connectGamepad(), false);
    const status = getGamepadInjectorStatus();
    assert.equal(status.ok, true);
    assert.equal(status.connected, false);
    assert.equal(status.platform, process.platform);
  });
});

test("non-Windows: injectGamepad does not throw", async () => {
  await withGamepad({}, async ({ injectGamepad }) => {
    assert.doesNotThrow(() =>
      injectGamepad({ axes: [0, 0, 0, 0], buttons: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }),
    );
  });
});

test("non-Windows: guardInput blocks injectGamepad callback", async () => {
  await withGamepad({}, async ({ injectGamepad }) => {
    const { setInputBlocked, clearAllowedTarget } = await import(
      "../dist/main/main/focus-guard.js"
    );

    clearAllowedTarget();
    setInputBlocked(true);
    assert.doesNotThrow(() =>
      injectGamepad({ axes: [1, 1, 1, 1], buttons: [1, 1, 1, 1, 0, 0, 0, 0, 0, 0] }),
    );
    setInputBlocked(false);
    clearAllowedTarget();
  });
});

test("Windows + ViGEm mock: connectGamepad succeeds and status is connected", async () => {
  const vigem = createVigemMock();
  await withGamepad({ platform: "win32", koffiMock: vigem.mock }, async ({
    connectGamepad,
    getGamepadInjectorStatus,
  }) => {
    assert.equal(connectGamepad(), true);
    const status = getGamepadInjectorStatus();
    assert.equal(status.ok, true);
    assert.equal(status.connected, true);
    assert.equal(status.error, "");
  });
});

test("Windows + ViGEm mock: injectGamepad maps buttons, triggers and axes to XUSB report", async () => {
  const vigem = createVigemMock();
  await withGamepad({ platform: "win32", koffiMock: vigem.mock }, async ({
    connectGamepad,
    injectGamepad,
  }) => {
    connectGamepad();
    injectGamepad({
      axes: [1, -0.5, 0, 0.25],
      buttons: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    });

    const report = vigem.getLastReport();
    assert.ok(report);
    assert.equal(report.wButtons, 0x1000);
    assert.equal(report.bLeftTrigger, 255);
    assert.equal(report.bRightTrigger, 0);
    assert.equal(report.sThumbLX, 32767);
    assert.equal(report.sThumbLY, 16384);
    assert.equal(report.sThumbRX, 0);
    assert.equal(report.sThumbRY, -8192);
  });
});

test("Windows + ViGEm mock: connectGamepad fails when vigem_connect errors", async () => {
  const vigem = createVigemMock({ connectCode: -1 });
  await withGamepad({ platform: "win32", koffiMock: vigem.mock }, async ({
    connectGamepad,
    getGamepadInjectorStatus,
  }) => {
    assert.equal(connectGamepad(), false);
    const status = getGamepadInjectorStatus();
    assert.equal(status.ok, false);
    assert.equal(status.connected, false);
    assert.match(status.error, /ViGEmBus/i);
  });
});

test("Windows + ViGEm mock: disconnectGamepad clears connected flag", async () => {
  const vigem = createVigemMock();
  await withGamepad({ platform: "win32", koffiMock: vigem.mock }, async ({
    connectGamepad,
    disconnectGamepad,
    getGamepadInjectorStatus,
  }) => {
    connectGamepad();
    assert.equal(getGamepadInjectorStatus().connected, true);
    disconnectGamepad();
    assert.equal(getGamepadInjectorStatus().connected, false);
  });
});
