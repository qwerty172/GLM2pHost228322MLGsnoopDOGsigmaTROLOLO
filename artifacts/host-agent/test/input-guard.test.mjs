import { test } from "node:test";
import assert from "node:assert/strict";
import { setupRendererEnv } from "./helpers/renderer-env.mjs";

setupRendererEnv();
const { updateInputGuardBadge, startGuardPolling, stopGuardPolling } = await import(
  "../dist/renderer/renderer/input-guard.js"
);
const { session } = await import("../dist/renderer/renderer/state.js");

test("updateInputGuardBadge shows panic state", () => {
  session.isStreaming = true;
  updateInputGuardBadge({
    foregroundAllowed: false,
    inputBlocked: true,
    guardDisabled: false,
    active: true,
  });
  const badge = document.getElementById("input-guard-badge");
  assert.equal(badge.hidden, false);
  assert.match(badge.textContent, /паника/);
});

test("updateInputGuardBadge hides badge when idle", () => {
  session.isStreaming = false;
  updateInputGuardBadge({
    foregroundAllowed: true,
    inputBlocked: false,
    guardDisabled: false,
    active: false,
  });
  assert.equal(document.getElementById("input-guard-badge").hidden, true);
});

test("stopGuardPolling clears timer and hides badge", () => {
  session.guardPollTimer = setInterval(() => {}, 10_000);
  stopGuardPolling();
  assert.equal(session.guardPollTimer, null);
  assert.equal(document.getElementById("input-guard-badge").hidden, true);
});

test("startGuardPolling replaces existing poll timer", () => {
  const oldTimer = setInterval(() => {}, 10_000);
  session.guardPollTimer = oldTimer;

  startGuardPolling();

  assert.notEqual(session.guardPollTimer, oldTimer);
  assert.ok(session.guardPollTimer);

  stopGuardPolling();
});

test("startGuardPolling polls agent status and updates badge", async () => {
  session.isStreaming = true;
  let callCount = 0;
  const orig = window.agent.getInputGuardStatus;
  window.agent.getInputGuardStatus = async () => {
    callCount += 1;
    return {
      foregroundAllowed: false,
      inputBlocked: true,
      guardDisabled: false,
      active: true,
    };
  };

  startGuardPolling();
  assert.ok(session.guardPollTimer);

  await new Promise((resolve) => setTimeout(resolve, 550));

  assert.ok(callCount >= 1);
  const badge = document.getElementById("input-guard-badge");
  assert.equal(badge.hidden, false);
  assert.match(badge.textContent, /паника/);

  stopGuardPolling();
  window.agent.getInputGuardStatus = orig;
});
