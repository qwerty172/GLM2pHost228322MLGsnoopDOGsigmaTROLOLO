import { test } from "node:test";
import assert from "node:assert/strict";
import { installRendererEnv, agentStub, RENDERER_DIST } from "./helpers/renderer-env.mjs";

installRendererEnv();

const { parseDcInputEvent, injectPlayerInput } = await import(
  new URL("input-mapping.js", RENDERER_DIST).href
);

test("parseDcInputEvent validates mousemove", () => {
  const ev = parseDcInputEvent({ kind: "mousemove", x: 0.5, y: 0.25 });
  assert.ok(ev);
  assert.equal(ev.kind, "mousemove");
  assert.equal(ev.x, 0.5);
});

test("parseDcInputEvent rejects invalid mouse coords", () => {
  assert.equal(parseDcInputEvent({ kind: "mousemove", x: "a", y: 1 }), null);
});

test("parseDcInputEvent accepts mouse buttons and wheel", () => {
  assert.ok(parseDcInputEvent({ kind: "mousedown", button: "left" }));
  assert.ok(parseDcInputEvent({ kind: "wheel", deltaY: -120 }));
  assert.equal(parseDcInputEvent({ kind: "mousedown", button: "back" }), null);
});

test("injectPlayerInput maps player protocol to agent.injectInput", () => {
  const injected = [];
  window.agent.injectInput = (ev) => injected.push(ev);
  injectPlayerInput({ type: "input", kind: "key", action: "down", code: "KeyW", key: "w" });
  assert.equal(injected.length, 1);
  assert.equal(injected[0].kind, "keydown");
});
