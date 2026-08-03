import { test, before } from "node:test";
import assert from "node:assert/strict";
import { installRendererDom } from "./helpers/dom-setup.mjs";

let $;
let statusText;

before(async () => {
  installRendererDom();
  ({ $, statusText } = await import("../dist/renderer/renderer/dom.js"));
});

test("$ returns element by id", () => {
  const el = $("connect");
  assert.equal(el.id, "connect");
});

test("statusText is wired to DOM", () => {
  statusText.textContent = "test";
  assert.equal(statusText.textContent, "test");
});
