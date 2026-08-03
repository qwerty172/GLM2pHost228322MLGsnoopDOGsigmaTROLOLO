import { test } from "node:test";
import assert from "node:assert/strict";

const { escHtml } = await import("../dist/renderer/renderer/utils.js");

test("escHtml escapes HTML special characters", () => {
  assert.equal(escHtml(`<a href="x">&</a>`), "&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
});

test("escHtml leaves safe text unchanged", () => {
  assert.equal(escHtml("Hello World 123"), "Hello World 123");
});
