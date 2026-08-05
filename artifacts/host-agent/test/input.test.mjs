import { test } from "node:test";
import assert from "node:assert/strict";

const {
  LOCAL_INPUT_SECRET,
  INPUT_SECRET_HEADER,
  parseInputEvent,
  parseGamepadState,
  parseHostConfigPatch,
} = await import("../dist/main/shared/input.js");

test("LOCAL_INPUT_SECRET and INPUT_SECRET_HEADER are stable", () => {
  assert.equal(LOCAL_INPUT_SECRET, "dh-local-input-v1");
  assert.equal(INPUT_SECRET_HEADER, "x-agent-input-secret");
});

test("parseInputEvent rejects non-objects and unknown kinds", () => {
  assert.equal(parseInputEvent(null), null);
  assert.equal(parseInputEvent("mousemove"), null);
  assert.equal(parseInputEvent({ kind: "click" }), null);
});

test("parseInputEvent accepts mousemove with optional mode", () => {
  assert.deepEqual(parseInputEvent({ kind: "mousemove", x: 0.5, y: 0.25 }), {
    kind: "mousemove",
    x: 0.5,
    y: 0.25,
  });
  assert.deepEqual(parseInputEvent({ kind: "mousemove", x: -3, y: 7, mode: "relative" }), {
    kind: "mousemove",
    x: -3,
    y: 7,
    mode: "relative",
  });
  assert.deepEqual(parseInputEvent({ kind: "mousemove", x: 1, y: 0, mode: "absolute" }), {
    kind: "mousemove",
    x: 1,
    y: 0,
    mode: "absolute",
  });
});

test("parseInputEvent rejects invalid mousemove", () => {
  assert.equal(parseInputEvent({ kind: "mousemove", x: "a", y: 1 }), null);
  assert.equal(parseInputEvent({ kind: "mousemove", x: Infinity, y: 1 }), null);
  assert.equal(parseInputEvent({ kind: "mousemove", x: 1, y: 1, mode: "delta" }), null);
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
  assert.equal(parseInputEvent({ kind: "mousedown", button: "back" }), null);
});

test("parseInputEvent validates wheel events", () => {
  assert.deepEqual(parseInputEvent({ kind: "wheel", deltaY: -120 }), {
    kind: "wheel",
    deltaY: -120,
  });
  assert.equal(parseInputEvent({ kind: "wheel", deltaY: "x" }), null);
  assert.equal(parseInputEvent({ kind: "wheel", deltaY: NaN }), null);
});

test("parseInputEvent validates keyboard events", () => {
  assert.deepEqual(parseInputEvent({ kind: "keydown", code: "KeyW", key: "w" }), {
    kind: "keydown",
    code: "KeyW",
    key: "w",
  });
  assert.equal(parseInputEvent({ kind: "keyup", code: 1, key: "w" }), null);
  assert.equal(
    parseInputEvent({ kind: "keydown", code: "x".repeat(65), key: "x" }),
    null,
  );
});

test("parseGamepadState clamps axes and normalizes buttons", () => {
  assert.deepEqual(
    parseGamepadState({
      axes: [0.5, -2, 3, "bad", Infinity],
      buttons: [0, 1, true, false, "on"],
    }),
    { axes: [0.5, -1, 1, 0, 0], buttons: [0, 1, 1, 0, 1] },
  );
});

test("parseGamepadState rejects invalid payloads", () => {
  assert.equal(parseGamepadState(null), null);
  assert.equal(parseGamepadState({ axes: [], buttons: "x" }), null);
  assert.equal(
    parseGamepadState({ axes: new Array(17).fill(0), buttons: [] }),
    null,
  );
  assert.equal(
    parseGamepadState({ axes: [], buttons: new Array(33).fill(0) }),
    null,
  );
});

test("parseHostConfigPatch accepts object patches", () => {
  const patch = { ratePerMinute: 0.5, allowPreview: false };
  assert.deepEqual(parseHostConfigPatch(patch), patch);
  assert.equal(parseHostConfigPatch(null), null);
  assert.equal(parseHostConfigPatch("cfg"), null);
});
