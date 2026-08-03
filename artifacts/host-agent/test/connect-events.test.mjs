import "../test/setup-renderer-dom.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { elements } from "../test/setup-renderer-dom.mjs";

await import("../dist/renderer/renderer/connect-events.js");

test("connect-events wires connect and disconnect buttons", () => {
  assert.ok(elements.get("connect"));
  assert.ok(elements.get("disconnect"));
  assert.ok(elements.get("confirm-game"));
  assert.ok(elements.get("cancel-game-picker"));
});
