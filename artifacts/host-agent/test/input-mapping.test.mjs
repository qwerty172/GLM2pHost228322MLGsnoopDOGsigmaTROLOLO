import { test } from "node:test";
import assert from "node:assert/strict";

const { parseDcInputEvent } = await import("../dist/renderer/renderer/input-mapping.js");

test("parseDcInputEvent accepts valid mousemove", () => {
  const ev = parseDcInputEvent({ kind: "mousemove", x: 0.5, y: 0.25 });
  assert.ok(ev);
  assert.equal(ev.kind, "mousemove");
});

test("parseDcInputEvent rejects invalid mousemove coords", () => {
  assert.equal(parseDcInputEvent({ kind: "mousemove", x: "a", y: 1 }), null);
  assert.equal(parseDcInputEvent({ kind: "mousemove", x: NaN, y: 1 }), null);
});

test("parseDcInputEvent validates mouse buttons", () => {
  assert.ok(parseDcInputEvent({ kind: "mousedown", button: "left" }));
  assert.ok(parseDcInputEvent({ kind: "mouseup", button: "right" }));
  assert.equal(parseDcInputEvent({ kind: "mousedown", button: "back" }), null);
});

test("parseDcInputEvent validates wheel and key events", () => {
  assert.ok(parseDcInputEvent({ kind: "wheel", deltaY: -120 }));
  assert.equal(parseDcInputEvent({ kind: "wheel", deltaY: "x" }), null);
  assert.ok(parseDcInputEvent({ kind: "keydown", code: "KeyW", key: "w" }));
  assert.equal(parseDcInputEvent({ kind: "keyup", code: 5, key: "w" }), null);
});

test("parseDcInputEvent rejects unknown kinds", () => {
  assert.equal(parseDcInputEvent({ kind: "gamepad" }), null);
});
