import { test } from "node:test";
import assert from "node:assert/strict";
import { setupRendererEnv } from "./helpers/renderer-env.mjs";

setupRendererEnv();
const { parseDcInputEvent, injectPlayerInput } = await import(
  "../dist/renderer/renderer/input-mapping.js"
);

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

test("injectPlayerInput uses event fallback when provided", () => {
  const injected = [];
  const orig = window.agent.injectInput;
  window.agent.injectInput = (ev) => injected.push(ev);
  try {
    const fallback = { kind: "keydown", code: "KeyW", key: "w" };
    injectPlayerInput({ event: fallback });
    assert.deepEqual(injected, [fallback]);
  } finally {
    window.agent.injectInput = orig;
  }
});

test("injectPlayerInput maps player key and mouse events", () => {
  const injected = [];
  const orig = window.agent.injectInput;
  window.agent.injectInput = (ev) => injected.push(ev);
  try {
    injectPlayerInput({ type: "input", kind: "key", action: "down", code: "KeyA", key: "a" });
    assert.deepEqual(injected, [{ kind: "keydown", code: "KeyA", key: "a" }]);

    injected.length = 0;
    injectPlayerInput({ type: "input", kind: "mouse", action: "move", x: 0.25, y: 0.75 });
    assert.deepEqual(injected, [{ kind: "mousemove", x: 0.25, y: 0.75, mode: "absolute" }]);

    injected.length = 0;
    injectPlayerInput({ type: "input", kind: "wheel", deltaY: 120 });
    assert.deepEqual(injected, [{ kind: "wheel", deltaY: 120 }]);
  } finally {
    window.agent.injectInput = orig;
  }
});

test("injectPlayerInput pre-moves cursor before mousedown", () => {
  const injected = [];
  const orig = window.agent.injectInput;
  window.agent.injectInput = (ev) => injected.push(ev);
  try {
    injectPlayerInput({ type: "input", kind: "mouse", action: "down", button: 0, x: 0.3, y: 0.7 });
    assert.equal(injected.length, 2);
    assert.deepEqual(injected[0], { kind: "mousemove", x: 0.3, y: 0.7, mode: "absolute" });
    assert.deepEqual(injected[1], { kind: "mousedown", button: "left" });
  } finally {
    window.agent.injectInput = orig;
  }
});
