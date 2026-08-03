import { test } from "node:test";
import assert from "node:assert/strict";
import { setupRendererEnv } from "./helpers/renderer-env.mjs";

setupRendererEnv();
const { escHtml } = await import("../dist/renderer/renderer/utils.js");

test("escHtml escapes HTML special characters", () => {
  assert.equal(escHtml("a<b>&\"c"), "a&lt;b&gt;&amp;&quot;c");
  assert.equal(escHtml(""), "");
  assert.equal(escHtml("plain text"), "plain text");
});
