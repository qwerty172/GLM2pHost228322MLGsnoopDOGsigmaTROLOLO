import { test } from "node:test";
import assert from "node:assert/strict";
import { installRendererEnv, RENDERER_DIST } from "./helpers/renderer-env.mjs";

installRendererEnv();

const { updateInputGuardBadge, stopGuardPolling } = await import(
  new URL("input-guard.js", RENDERER_DIST).href
);
const { session } = await import(new URL("state.js", RENDERER_DIST).href);

test("updateInputGuardBadge shows panic state", () => {
  const badge = document.getElementById("input-guard-badge");
  session.isStreaming = true;
  updateInputGuardBadge({
    foregroundAllowed: true,
    inputBlocked: true,
    guardDisabled: false,
    active: true,
  });
  assert.equal(badge.hidden, false);
  assert.match(badge.textContent, /заблокирован/);
  stopGuardPolling();
  session.isStreaming = false;
});
