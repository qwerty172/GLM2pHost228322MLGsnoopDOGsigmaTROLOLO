import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";

const {
  setAllowedTarget,
  clearAllowedTarget,
  setInputBlocked,
  isInputAllowed,
  isInputBlocked,
  getFocusGuardStatus,
  guardInput,
  _testing,
} = await import("../dist/main/main/focus-guard.js");

beforeEach(() => {
  _testing.resetState();
});

after(() => {
  _testing.resetState();
});

test("isInputAllowed when no target configured", () => {
  assert.equal(isInputAllowed(), true);
  assert.equal(getFocusGuardStatus().active, false);
});

test("setInputBlocked denies all input", () => {
  setInputBlocked(true);
  assert.equal(isInputAllowed(), false);
  assert.equal(isInputBlocked(), true);
  assert.equal(getFocusGuardStatus().inputBlocked, true);
  assert.equal(getFocusGuardStatus().foregroundAllowed, false);
});

test("guardDisabled allows input even with allowedPid set", () => {
  setAllowedTarget(1234, { guardDisabled: true });
  _testing.setWin32Guard({
    getForegroundPid: () => 9999,
    isPidAllowed: () => false,
  });
  assert.equal(isInputAllowed(), true);
  assert.equal(getFocusGuardStatus().guardDisabled, true);
});

test("guardInput runs callback when allowed", () => {
  let ran = false;
  const result = guardInput(() => {
    ran = true;
    return 42;
  });
  assert.equal(ran, true);
  assert.equal(result, 42);
});

test("guardInput skips callback when panic-blocked", () => {
  setInputBlocked(true);
  let ran = false;
  const result = guardInput(() => {
    ran = true;
    return 42;
  });
  assert.equal(ran, false);
  assert.equal(result, undefined);
});

test("foreground PID must match allowed process tree", () => {
  setAllowedTarget(100);
  _testing.setWin32Guard({
    getForegroundPid: () => 200,
    isPidAllowed: (fg, root) => fg === 200 && root === 100,
  });
  assert.equal(isInputAllowed(), true);

  _testing.setWin32Guard({
    getForegroundPid: () => 300,
    isPidAllowed: () => false,
  });
  assert.equal(isInputAllowed(), false);
  assert.equal(getFocusGuardStatus().foregroundAllowed, false);
});

test("no foreground window denies input when guard active", () => {
  setAllowedTarget(100);
  _testing.setWin32Guard({
    getForegroundPid: () => null,
    isPidAllowed: () => true,
  });
  assert.equal(isInputAllowed(), false);
});

test("clearAllowedTarget resets guard state", () => {
  setAllowedTarget(100);
  setInputBlocked(true);
  clearAllowedTarget();
  setInputBlocked(false);
  assert.equal(getFocusGuardStatus().allowedPid, null);
  assert.equal(isInputAllowed(), true);
});
