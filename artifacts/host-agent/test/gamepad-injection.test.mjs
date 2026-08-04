// Unit tests for ViGEm virtual Xbox 360 gamepad injection (gamepad-injection.ts).
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const appPath = mkdtempSync(path.join(tmpdir(), "gamepad-inj-"));
const vigemReports = [];

function createMockKoffi() {
  return {
    struct: (name, fields) =>
      function XUSB_REPORT(data) {
        return { ...data };
      },
    load: (dllPath) => ({
      func: (signature) => {
        if (signature.includes("vigem_alloc")) return () => ({ client: 1 });
        if (signature.includes("vigem_free")) return () => {};
        if (signature.includes("vigem_connect")) return () => 0;
        if (signature.includes("vigem_disconnect")) return () => {};
        if (signature.includes("vigem_target_x360_alloc")) return () => ({ target: 1 });
        if (signature.includes("vigem_target_free")) return () => {};
        if (signature.includes("vigem_target_add")) return () => 0;
        if (signature.includes("vigem_target_remove")) return () => 0;
        if (signature.includes("vigem_target_x360_update")) {
          return (client, target, report) => {
            vigemReports.push(report);
            return 0;
          };
        }
        throw new Error(`unexpected vigem signature: ${signature}`);
      },
    }),
  };
}

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return { app: { getAppPath: () => appPath } };
  }
  if (request === "koffi") {
    return createMockKoffi();
  }
  return load.apply(this, arguments);
};

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const mainDistSegment = `${path.sep}dist${path.sep}main${path.sep}main${path.sep}`;

function clearMainModuleCache() {
  for (const key of Object.keys(require.cache)) {
    if (key.includes(mainDistSegment)) delete require.cache[key];
  }
}

async function importGamepadModule(platform) {
  clearMainModuleCache();
  Object.defineProperty(process, "platform", {
    value: platform,
    configurable: true,
  });
  const url = new URL("../dist/main/main/gamepad-injection.js", import.meta.url);
  url.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  return import(url.href);
}

function sampleState() {
  return {
    axes: [1, 1, -0.5, 0.5],
    buttons: [1, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  };
}

describe("gamepad-injection", { concurrency: false }, () => {
test("non-Windows: connectGamepad returns false and status stays disconnected", async () => {
  const {
    connectGamepad,
    disconnectGamepad,
    getGamepadInjectorStatus,
    destroyGamepadInjector,
  } = await importGamepadModule("linux");

  destroyGamepadInjector();
  assert.equal(connectGamepad(), false);
  const status = getGamepadInjectorStatus();
  assert.equal(status.ok, true);
  assert.equal(status.connected, false);
  assert.equal(status.platform, "linux");
  disconnectGamepad();
});

test("non-Windows: injectGamepad does not throw when disconnected", async () => {
  const { injectGamepad, destroyGamepadInjector } = await importGamepadModule(
    "linux",
  );

  destroyGamepadInjector();
  injectGamepad(sampleState());
});

test("non-Windows: getGamepadInjectorStatus returns a shallow copy", async () => {
  const { getGamepadInjectorStatus, destroyGamepadInjector } =
    await importGamepadModule("linux");

  destroyGamepadInjector();
  const a = getGamepadInjectorStatus();
  const b = getGamepadInjectorStatus();
  assert.notEqual(a, b);
  assert.deepEqual(a, b);
});

test("Windows mock: connectGamepad succeeds via ViGEm stubs", async () => {
  vigemReports.length = 0;
  const {
    connectGamepad,
    getGamepadInjectorStatus,
    destroyGamepadInjector,
  } = await importGamepadModule("win32");

  destroyGamepadInjector();
  assert.equal(connectGamepad(), true);
  const status = getGamepadInjectorStatus();
  assert.equal(status.ok, true);
  assert.equal(status.connected, true);
  assert.equal(status.error, "");
  destroyGamepadInjector();
});

test("Windows mock: injectGamepad maps buttons, triggers and inverted Y axes", async () => {
  vigemReports.length = 0;
  const { connectGamepad, injectGamepad, destroyGamepadInjector } =
    await importGamepadModule("win32");

  destroyGamepadInjector();
  connectGamepad();
  injectGamepad(sampleState());

  assert.equal(vigemReports.length, 1);
  const report = vigemReports[0];
  assert.equal(report.wButtons, 0x1000 | 0x4000);
  assert.equal(report.bLeftTrigger, 255);
  assert.equal(report.bRightTrigger, 0);
  assert.equal(report.sThumbLX, 32767);
  assert.equal(report.sThumbLY, -32767);
  assert.equal(report.sThumbRX, -16383);
  assert.equal(report.sThumbRY, -16383);
  destroyGamepadInjector();
});

test("Windows mock: disconnectGamepad clears connected flag", async () => {
  vigemReports.length = 0;
  const {
    connectGamepad,
    disconnectGamepad,
    getGamepadInjectorStatus,
    destroyGamepadInjector,
  } = await importGamepadModule("win32");

  destroyGamepadInjector();
  connectGamepad();
  disconnectGamepad();
  assert.equal(getGamepadInjectorStatus().connected, false);
});

test("Windows mock: connectGamepad is idempotent when already connected", async () => {
  vigemReports.length = 0;
  const { connectGamepad, destroyGamepadInjector } =
    await importGamepadModule("win32");

  destroyGamepadInjector();
  assert.equal(connectGamepad(), true);
  assert.equal(connectGamepad(), true);
  destroyGamepadInjector();
});
});
