import { test } from "node:test";
import assert from "node:assert/strict";
import { setupRendererEnv } from "./helpers/renderer-env.mjs";

setupRendererEnv();
const { updateInputGuardBadge, stopGuardPolling } = await import(
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
