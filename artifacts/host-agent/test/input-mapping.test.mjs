import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDcInputEvent } from "../dist/renderer/renderer/input-mapping.js";

test("parseDcInputEvent accepts valid mousemove", () => {
  const ev = parseDcInputEvent({ kind: "mousemove", x: 0.5, y: 0.25 });
  assert.ok(ev);
  assert.equal(ev.kind, "mousemove");
});

test("parseDcInputEvent rejects invalid coords", () => {
  assert.equal(parseDcInputEvent({ kind: "mousemove", x: "a", y: 1 }), null);
});

test("parseDcInputEvent maps key events", () => {
  const ev = parseDcInputEvent({ kind: "keydown", code: "KeyA", key: "a" });
  assert.equal(ev?.kind, "keydown");
});
