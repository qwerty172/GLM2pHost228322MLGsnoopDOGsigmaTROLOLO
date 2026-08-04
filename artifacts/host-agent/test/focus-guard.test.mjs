import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";

// focus-guard → logger requires electron at load time
const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return { app: { getAppPath: () => "/tmp/test-agent" } };
  }
  return load.apply(this, arguments);
};

const {
  setAllowedTarget,
  clearAllowedTarget,
  setInputBlocked,
  isInputAllowed,
  isInputBlocked,
  guardInput,
  getFocusGuardStatus,
} = await import("../dist/main/main/focus-guard.js");

beforeEach(() => {
  clearAllowedTarget();
  setInputBlocked(false);
});

test("isInputAllowed allows input when guard is not configured", () => {
  assert.equal(isInputAllowed(), true);
});

test("isInputAllowed blocks input when panic-blocked", () => {
  setInputBlocked(true);
  assert.equal(isInputAllowed(), false);
  assert.equal(isInputBlocked(), true);
});

test("guardDisabled allows input even with allowedPid set", () => {
  setAllowedTarget(12345, { guardDisabled: true });
  assert.equal(isInputAllowed(), true);
  const status = getFocusGuardStatus();
  assert.equal(status.guardDisabled, true);
  assert.equal(status.allowedPid, 12345);
  assert.equal(status.foregroundAllowed, true);
});

test("guardInput runs callback when input is allowed", () => {
  let called = false;
  const result = guardInput(() => {
    called = true;
    return 42;
  });
  assert.equal(called, true);
  assert.equal(result, 42);
});

test("guardInput skips callback when input is blocked", () => {
  setInputBlocked(true);
  let called = false;
  const result = guardInput(() => {
    called = true;
    return 42;
  });
  assert.equal(called, false);
  assert.equal(result, undefined);
});

test("getFocusGuardStatus reflects blocked foreground when panic active", () => {
  setAllowedTarget(999, { guardDisabled: false });
  setInputBlocked(true);
  const status = getFocusGuardStatus();
  assert.equal(status.inputBlocked, true);
  assert.equal(status.foregroundAllowed, false);
  assert.equal(status.active, true);
});

test("clearAllowedTarget resets guard state", () => {
  setAllowedTarget(555, { guardDisabled: true });
  clearAllowedTarget();
  const status = getFocusGuardStatus();
  assert.equal(status.allowedPid, null);
  assert.equal(status.guardDisabled, false);
  assert.equal(status.active, false);
});
