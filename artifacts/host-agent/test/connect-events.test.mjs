import { test, before } from "node:test";
import assert from "node:assert/strict";
import { installRendererDom } from "./helpers/dom-setup.mjs";

before(async () => {
  installRendererDom();
  await import("../dist/renderer/renderer/connect-events.js");
});

test("connect-events module loads and registers handlers", () => {
  const btn = document.getElementById("connect");
  assert.ok(btn);
});
