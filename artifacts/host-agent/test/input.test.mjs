import { test } from "node:test";
import assert from "node:assert/strict";

const {
  parseInputEvent,
  parseGamepadState,
  parseHostConfigPatch,
  LOCAL_INPUT_SECRET,
  INPUT_SECRET_HEADER,
} = await import("../dist/main/shared/input.js");

// ─── constants ───────────────────────────────────────────────────────────────

test("LOCAL_INPUT_SECRET and INPUT_SECRET_HEADER are stable", () => {
  assert.equal(LOCAL_INPUT_SECRET, "dh-local-input-v1");
  assert.equal(INPUT_SECRET_HEADER, "x-agent-input-secret");
});

// ─── parseInputEvent ─────────────────────────────────────────────────────────

test("parseInputEvent accepts mousemove with absolute and relative mode", () => {
  const abs = parseInputEvent({ kind: "mousemove", x: 0.5, y: 0.25, mode: "absolute" });
  assert.deepEqual(abs, { kind: "mousemove", x: 0.5, y: 0.25, mode: "absolute" });

  const rel = parseInputEvent({ kind: "mousemove", x: -10, y: 3, mode: "relative" });
  assert.deepEqual(rel, { kind: "mousemove", x: -10, y: 3, mode: "relative" });
});

test("parseInputEvent omits mode when unset", () => {
  const ev = parseInputEvent({ kind: "mousemove", x: 0.1, y: 0.9 });
  assert.deepEqual(ev, { kind: "mousemove", x: 0.1, y: 0.9 });
});

test("parseInputEvent rejects invalid mousemove mode", () => {
  assert.equal(parseInputEvent({ kind: "mousemove", x: 1, y: 1, mode: "screen" }), null);
});

test("parseInputEvent accepts all mouse buttons", () => {
  for (const button of ["left", "right", "middle"]) {
    assert.deepEqual(parseInputEvent({ kind: "mousedown", button }), { kind: "mousedown", button });
    assert.deepEqual(parseInputEvent({ kind: "mouseup", button }), { kind: "mouseup", button });
  }
});

test("parseInputEvent validates wheel deltaY", () => {
  assert.deepEqual(parseInputEvent({ kind: "wheel", deltaY: -120 }), { kind: "wheel", deltaY: -120 });
  assert.equal(parseInputEvent({ kind: "wheel", deltaY: Infinity }), null);
});

test("parseInputEvent validates keyboard events and length limits", () => {
  assert.deepEqual(parseInputEvent({ kind: "keydown", code: "KeyW", key: "w" }), {
    kind: "keydown",
    code: "KeyW",
    key: "w",
  });
  const long = "x".repeat(65);
  assert.equal(parseInputEvent({ kind: "keyup", code: long, key: "a" }), null);
  assert.equal(parseInputEvent({ kind: "keyup", code: "KeyA", key: long }), null);
});

test("parseInputEvent rejects invalid payloads", () => {
  assert.equal(parseInputEvent(null), null);
  assert.equal(parseInputEvent("keydown"), null);
  assert.equal(parseInputEvent({ kind: "gamepad" }), null);
  assert.equal(parseInputEvent({ kind: "mousemove", x: "a", y: 1 }), null);
  assert.equal(parseInputEvent({ kind: "mousedown", button: "back" }), null);
});

// ─── parseGamepadState ───────────────────────────────────────────────────────

test("parseGamepadState clamps axes and normalizes buttons", () => {
  const state = parseGamepadState({
    axes: [2, -1.5, 0.5, "bad", NaN],
    buttons: [1, 0, true, false, 2],
  });
  assert.deepEqual(state, {
    axes: [1, -1, 0.5, 0, 0],
    buttons: [1, 0, 1, 0, 1],
  });
});

test("parseGamepadState rejects oversized arrays and non-objects", () => {
  assert.equal(parseGamepadState(null), null);
  assert.equal(parseGamepadState({ axes: new Array(17).fill(0), buttons: [] }), null);
  assert.equal(parseGamepadState({ axes: [], buttons: new Array(33).fill(0) }), null);
  assert.equal(parseGamepadState({ axes: "x", buttons: [] }), null);
});

// ─── parseHostConfigPatch ────────────────────────────────────────────────────

test("parseHostConfigPatch accepts object patches and rejects non-objects", () => {
  const patch = { ratePerMinute: 0.5, allowPreview: false };
  assert.deepEqual(parseHostConfigPatch(patch), patch);
  assert.equal(parseHostConfigPatch(null), null);
  assert.equal(parseHostConfigPatch("patch"), null);
});
