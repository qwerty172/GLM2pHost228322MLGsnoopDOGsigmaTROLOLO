import { test } from "node:test";
import assert from "node:assert/strict";
import { installRendererEnv, RENDERER_DIST } from "./helpers/renderer-env.mjs";

installRendererEnv();

const { $, statusText, connectBtn } = await import(new URL("dom.js", RENDERER_DIST).href);

test("$ returns element by id", () => {
  const el = $("hostToken");
  assert.equal(el.id, "hostToken");
});

test("dom exports bind common UI elements", () => {
  assert.equal(statusText.id, "status-text");
  assert.equal(connectBtn.id, "connect");
});

test("$ throws for missing element", () => {
  assert.throws(() => $("nonexistent-element-id-xyz"), /Missing #nonexistent-element-id-xyz/);
});
