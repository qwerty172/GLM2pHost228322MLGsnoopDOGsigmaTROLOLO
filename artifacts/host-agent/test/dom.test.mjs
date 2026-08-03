import "../test/setup-renderer-dom.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { elements } from "../test/setup-renderer-dom.mjs";

const { $ } = await import("../dist/renderer/renderer/dom.js");

test("$ returns element by id", () => {
  const el = $("hostToken");
  assert.ok(el);
  assert.equal(el, elements.get("hostToken"));
});

test("dom exports key UI references", async () => {
  const dom = await import("../dist/renderer/renderer/dom.js");
  assert.ok(dom.connectBtn);
  assert.ok(dom.form);
  assert.ok(dom.playerLinkInput);
});
