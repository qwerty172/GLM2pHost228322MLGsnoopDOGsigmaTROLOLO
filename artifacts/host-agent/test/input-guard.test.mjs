import "../test/setup-renderer-dom.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { elements } from "../test/setup-renderer-dom.mjs";

const { updateInputGuardBadge } = await import("../dist/renderer/renderer/input-guard.js");
const { session } = await import("../dist/renderer/renderer/state.js");

test("updateInputGuardBadge shows panic state", () => {
  const badge = elements.get("input-guard-badge");
  session.isStreaming = true;
  updateInputGuardBadge({
    foregroundAllowed: true,
    inputBlocked: true,
    guardDisabled: false,
    active: true,
  });
  assert.equal(badge.hidden, false);
  assert.match(badge.textContent, /паника/);
});

test("updateInputGuardBadge hides when inactive and not streaming", () => {
  const badge = elements.get("input-guard-badge");
  session.isStreaming = false;
  updateInputGuardBadge({
    foregroundAllowed: true,
    inputBlocked: false,
    guardDisabled: false,
    active: false,
  });
  assert.equal(badge.hidden, true);
});
