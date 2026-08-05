// Unit tests for shared input parsing (input.ts).
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

// ─── parseInputEvent ───────────────────────────────────────────────────────

test("parseInputEvent accepts mousemove without mode", () => {
  const ev = parseInputEvent({ kind: "mousemove", x: 0.5, y: 0.25 });
  assert.deepEqual(ev, { kind: "mousemove", x: 0.5, y: 0.25 });
});

test("parseInputEvent accepts mousemove with absolute and relative mode", () => {
  assert.deepEqual(
    parseInputEvent({ kind: "mousemove", x: 1, y: 0, mode: "absolute" }),
    { kind: "mousemove", x: 1, y: 0, mode: "absolute" },
  );
  assert.deepEqual(
    parseInputEvent({ kind: "mousemove", x: -3, y: 7, mode: "relative" }),
    { kind: "mousemove", x: -3, y: 7, mode: "relative" },
  );
});

test("parseInputEvent rejects invalid mousemove", () => {
  assert.equal(parseInputEvent({ kind: "mousemove", x: "a", y: 1 }), null);
  assert.equal(parseInputEvent({ kind: "mousemove", x: NaN, y: 1 }), null);
  assert.equal(parseInputEvent({ kind: "mousemove", x: Infinity, y: 1 }), null);
  assert.equal(parseInputEvent({ kind: "mousemove", x: 0, y: 0, mode: "delta" }), null);
});

test("parseInputEvent validates mouse buttons", () => {
  assert.deepEqual(parseInputEvent({ kind: "mousedown", button: "left" }), {
    kind: "mousedown",
    button: "left",
  });
  assert.deepEqual(parseInputEvent({ kind: "mouseup", button: "right" }), {
    kind: "mouseup",
    button: "right",
  });
  assert.deepEqual(parseInputEvent({ kind: "mousedown", button: "middle" }), {
    kind: "mousedown",
    button: "middle",
  });
  assert.equal(parseInputEvent({ kind: "mousedown", button: "back" }), null);
});

test("parseInputEvent validates wheel events", () => {
  assert.deepEqual(parseInputEvent({ kind: "wheel", deltaY: -120 }), {
    kind: "wheel",
    deltaY: -120,
  });
  assert.equal(parseInputEvent({ kind: "wheel", deltaY: "x" }), null);
  assert.equal(parseInputEvent({ kind: "wheel", deltaY: Infinity }), null);
});

test("parseInputEvent validates keyboard events", () => {
  assert.deepEqual(parseInputEvent({ kind: "keydown", code: "KeyW", key: "w" }), {
    kind: "keydown",
    code: "KeyW",
    key: "w",
  });
  assert.deepEqual(parseInputEvent({ kind: "keyup", code: "Space", key: " " }), {
    kind: "keyup",
    code: "Space",
    key: " ",
  });
  assert.equal(parseInputEvent({ kind: "keyup", code: 1, key: "w" }), null);
  assert.equal(parseInputEvent({ kind: "keydown", code: "x".repeat(65), key: "x" }), null);
  assert.equal(parseInputEvent({ kind: "keydown", code: "KeyA", key: "y".repeat(65) }), null);
});

test("parseInputEvent rejects unknown kinds and non-objects", () => {
  assert.equal(parseInputEvent({ kind: "gamepad" }), null);
  assert.equal(parseInputEvent(null), null);
  assert.equal(parseInputEvent(undefined), null);
  assert.equal(parseInputEvent("mousemove"), null);
});

// ─── parseGamepadState ─────────────────────────────────────────────────────

test("parseGamepadState normalizes axes and buttons", () => {
  const state = parseGamepadState({
    axes: [0.5, -2, 1.5, "bad", NaN],
    buttons: [1, 0, true, false, "x"],
  });
  assert.deepEqual(state, {
    axes: [0.5, -1, 1, 0, 0],
    buttons: [1, 0, 1, 0, 1],
  });
});

test("parseGamepadState rejects invalid payloads", () => {
  assert.equal(parseGamepadState(null), null);
  assert.equal(parseGamepadState({ axes: [0], buttons: "nope" }), null);
  assert.equal(parseGamepadState({ axes: new Array(17).fill(0), buttons: [] }), null);
  assert.equal(parseGamepadState({ axes: [], buttons: new Array(33).fill(0) }), null);
});

// ─── parseHostConfigPatch ──────────────────────────────────────────────────

test("parseHostConfigPatch accepts object patches and rejects non-objects", () => {
  const patch = { ratePerMinute: 10, allowPreview: false };
  assert.deepEqual(parseHostConfigPatch(patch), patch);
  assert.equal(parseHostConfigPatch(null), null);
  assert.equal(parseHostConfigPatch("patch"), null);
});
