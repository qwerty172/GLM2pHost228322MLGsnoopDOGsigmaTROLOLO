// Unit tests for main-process input focus guard.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

const {
  setAllowedTarget,
  clearAllowedTarget,
  setInputBlocked,
  isInputBlocked,
  isInputAllowed,
  getFocusGuardStatus,
  guardInput,
} = await import("../dist/main/main/focus-guard.js");

beforeEach(() => {
  clearAllowedTarget();
  setInputBlocked(false);
});

test("isInputAllowed when no target configured", () => {
  assert.equal(isInputAllowed(), true);
  assert.deepEqual(getFocusGuardStatus(), {
    active: false,
    allowedPid: null,
    guardDisabled: false,
    foregroundAllowed: true,
    inputBlocked: false,
  });
});

test("setInputBlocked denies all input", () => {
  setAllowedTarget(1234);
  setInputBlocked(true);
  assert.equal(isInputBlocked(), true);
  assert.equal(isInputAllowed(), false);
  const status = getFocusGuardStatus();
  assert.equal(status.inputBlocked, true);
  assert.equal(status.foregroundAllowed, false);
});

test("guardDisabled allows input for browser games", () => {
  setAllowedTarget(null, { guardDisabled: true });
  setInputBlocked(false);
  assert.equal(isInputAllowed(), true);
  const status = getFocusGuardStatus();
  assert.equal(status.guardDisabled, true);
  assert.equal(status.active, true);
  assert.equal(status.foregroundAllowed, true);
});

test("guardInput runs callback when allowed and skips when blocked", () => {
  let called = 0;
  assert.equal(guardInput(() => { called += 1; return 42; }), 42);
  assert.equal(called, 1);

  setInputBlocked(true);
  assert.equal(guardInput(() => { called += 1; return 99; }), undefined);
  assert.equal(called, 1);
});

test("clearAllowedTarget resets pid and guardDisabled", () => {
  setAllowedTarget(999, { guardDisabled: true });
  clearAllowedTarget();
  assert.equal(getFocusGuardStatus().allowedPid, null);
  assert.equal(getFocusGuardStatus().guardDisabled, false);
});
