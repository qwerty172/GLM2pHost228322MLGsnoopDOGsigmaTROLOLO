import { test } from "node:test";
import assert from "node:assert/strict";
import { setupRendererEnv } from "./helpers/renderer-env.mjs";

setupRendererEnv();
const { parseDcInputEvent } = await import("../dist/renderer/renderer/input-mapping.js");

test("parseDcInputEvent accepts absolute mousemove", () => {
  const ev = parseDcInputEvent({ kind: "mousemove", x: 0.5, y: 0.25, mode: "absolute" });
  assert.deepEqual(ev, { kind: "mousemove", x: 0.5, y: 0.25, mode: "absolute" });
});

test("parseDcInputEvent accepts relative mousemove", () => {
  const ev = parseDcInputEvent({ kind: "mousemove", x: -3, y: 7, mode: "relative" });
  assert.deepEqual(ev, { kind: "mousemove", x: -3, y: 7, mode: "relative" });
});

test("parseDcInputEvent rejects invalid mouse coords", () => {
  assert.equal(parseDcInputEvent({ kind: "mousemove", x: "a", y: 1 }), null);
  assert.equal(parseDcInputEvent({ kind: "mousemove", x: Infinity, y: 1 }), null);
});

test("parseDcInputEvent validates mouse buttons and keys", () => {
  assert.deepEqual(parseDcInputEvent({ kind: "mousedown", button: "left" }), {
    kind: "mousedown",
    button: "left",
  });
  assert.equal(parseDcInputEvent({ kind: "mousedown", button: "back" }), null);
  assert.deepEqual(parseDcInputEvent({ kind: "keydown", code: "KeyW", key: "w" }), {
    kind: "keydown",
    code: "KeyW",
    key: "w",
  });
  assert.equal(parseDcInputEvent({ kind: "keyup", code: 1, key: "w" }), null);
});

test("parseDcInputEvent validates wheel events", () => {
  assert.deepEqual(parseDcInputEvent({ kind: "wheel", deltaY: -120 }), {
    kind: "wheel",
    deltaY: -120,
  });
  assert.equal(parseDcInputEvent({ kind: "wheel", deltaY: "x" }), null);
});
