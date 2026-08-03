import { test, before } from "node:test";
import assert from "node:assert/strict";
import { installRendererDom } from "./helpers/dom-setup.mjs";

let updateInputGuardBadge;
let session;

before(async () => {
  installRendererDom();
  ({ updateInputGuardBadge } = await import("../dist/renderer/renderer/input-guard.js"));
  ({ session } = await import("../dist/renderer/renderer/state.js"));
});

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
  assert.match(badge.textContent, /заблокирован/);
});
