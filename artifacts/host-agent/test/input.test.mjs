import { test } from "node:test";
import assert from "node:assert/strict";

const {
  parseInputEvent,
  parseGamepadState,
  parseHostConfigPatch,
  LOCAL_INPUT_SECRET,
  INPUT_SECRET_HEADER,
} = await import("../dist/main/shared/input.js");

test("LOCAL_INPUT_SECRET and INPUT_SECRET_HEADER are stable", () => {
  assert.equal(LOCAL_INPUT_SECRET, "dh-local-input-v1");
  assert.equal(INPUT_SECRET_HEADER, "x-agent-input-secret");
});

// ─── parseInputEvent ─────────────────────────────────────────────────────────

test("parseInputEvent accepts mousemove with absolute mode", () => {
  const ev = parseInputEvent({ kind: "mousemove", x: 0.5, y: 0.25, mode: "absolute" });
  assert.deepEqual(ev, { kind: "mousemove", x: 0.5, y: 0.25, mode: "absolute" });
});

test("parseInputEvent accepts mousemove with relative mode", () => {
  const ev = parseInputEvent({ kind: "mousemove", x: -12, y: 8, mode: "relative" });
  assert.deepEqual(ev, { kind: "mousemove", x: -12, y: 8, mode: "relative" });
});

test("parseInputEvent omits mode when unset or invalid", () => {
  assert.deepEqual(parseInputEvent({ kind: "mousemove", x: 1, y: 0 }), {
    kind: "mousemove",
    x: 1,
    y: 0,
  });
  assert.equal(parseInputEvent({ kind: "mousemove", x: 1, y: 0, mode: "invalid" }), null);
});

test("parseInputEvent rejects non-finite mousemove coords", () => {
  assert.equal(parseInputEvent({ kind: "mousemove", x: Infinity, y: 0 }), null);
  assert.equal(parseInputEvent({ kind: "mousemove", x: 0, y: -Infinity }), null);
});

test("parseInputEvent accepts middle mouse button", () => {
  assert.deepEqual(parseInputEvent({ kind: "mousedown", button: "middle" }), {
    kind: "mousedown",
    button: "middle",
  });
});

test("parseInputEvent rejects oversized key/code strings", () => {
  const long = "x".repeat(65);
  assert.equal(parseInputEvent({ kind: "keydown", code: long, key: "a" }), null);
  assert.equal(parseInputEvent({ kind: "keyup", code: "KeyA", key: long }), null);
});

test("parseInputEvent rejects wheel with non-finite deltaY", () => {
  assert.equal(parseInputEvent({ kind: "wheel", deltaY: NaN }), null);
  assert.equal(parseInputEvent({ kind: "wheel", deltaY: Infinity }), null);
});

// ─── parseGamepadState ───────────────────────────────────────────────────────

test("parseGamepadState normalizes axes and buttons", () => {
  const state = parseGamepadState({
    axes: [1.5, -2, 0.5, "bad", null],
    buttons: [1, 0, true, false, "x"],
  });
  assert.deepEqual(state, {
    axes: [1, -1, 0.5, 0, 0],
    buttons: [1, 0, 1, 0, 1],
  });
});

test("parseGamepadState rejects oversized arrays", () => {
  assert.equal(parseGamepadState({ axes: new Array(17).fill(0), buttons: [] }), null);
  assert.equal(parseGamepadState({ axes: [], buttons: new Array(33).fill(0) }), null);
});

test("parseGamepadState rejects non-array fields", () => {
  assert.equal(parseGamepadState({ axes: "x", buttons: [] }), null);
  assert.equal(parseGamepadState({ axes: [], buttons: null }), null);
  assert.equal(parseGamepadState(null), null);
});

// ─── parseHostConfigPatch ────────────────────────────────────────────────────

test("parseHostConfigPatch accepts plain objects", () => {
  const patch = { ratePerMinute: 10, allowPreview: false };
  assert.deepEqual(parseHostConfigPatch(patch), patch);
});

test("parseHostConfigPatch rejects non-objects", () => {
  assert.equal(parseHostConfigPatch(null), null);
  assert.equal(parseHostConfigPatch("cfg"), null);
  assert.equal(parseHostConfigPatch(42), null);
});
