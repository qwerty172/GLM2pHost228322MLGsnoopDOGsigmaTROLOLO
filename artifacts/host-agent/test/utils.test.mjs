import { test } from "node:test";
import assert from "node:assert/strict";
import { escHtml } from "../dist/renderer/renderer/utils.js";

test("escHtml escapes HTML special characters", () => {
  assert.equal(escHtml("a&b<c>\"d"), "a&amp;b&lt;c&gt;&quot;d");
  assert.equal(escHtml(""), "");
});
