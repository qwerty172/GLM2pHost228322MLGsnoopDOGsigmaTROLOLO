import { test } from "node:test";
import assert from "node:assert/strict";
import { setupRendererEnv } from "./helpers/renderer-env.mjs";

setupRendererEnv();
const dom = await import("../dist/renderer/renderer/dom.js");

test("dom exports core UI element references", () => {
  assert.equal(dom.form.id, "settings-form");
  assert.equal(dom.connectBtn.id, "connect");
  assert.equal(dom.disconnectBtn.id, "disconnect");
  assert.equal(dom.logEl.id, "log");
  assert.equal(dom.statusText.id, "status-text");
});

test("$ throws when element is missing", () => {
  assert.throws(() => dom.$("definitely-missing-element"), /Missing #definitely-missing-element/);
});
