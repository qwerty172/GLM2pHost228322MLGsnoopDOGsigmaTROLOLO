import { test } from "node:test";
import assert from "node:assert/strict";

const { KEY_CATALOGUE, KEYBOARD_PRESETS } = await import("../src/components/KeyboardOverlay.tsx");

test("KEY_CATALOGUE entries have label, key, and code", () => {
  assert.ok(KEY_CATALOGUE.length > 10);
  for (const entry of KEY_CATALOGUE) {
    assert.ok(entry.label.length > 0);
    assert.ok(entry.key.length > 0);
    assert.ok(entry.code.length > 0);
  }
});

test("KEY_CATALOGUE codes are unique", () => {
  const codes = KEY_CATALOGUE.map((e) => e.code);
  assert.equal(new Set(codes).size, codes.length);
});

test("KEY_CATALOGUE includes WASD movement keys", () => {
  const byCode = Object.fromEntries(KEY_CATALOGUE.map((e) => [e.code, e]));
  assert.deepEqual(byCode.KeyW, { label: "W", key: "w", code: "KeyW" });
  assert.deepEqual(byCode.KeyA, { label: "A", key: "a", code: "KeyA" });
  assert.deepEqual(byCode.KeyS, { label: "S", key: "s", code: "KeyS" });
  assert.deepEqual(byCode.KeyD, { label: "D", key: "d", code: "KeyD" });
});

test("KEYBOARD_PRESETS exposes wasd, arrows, and custom layouts", () => {
  assert.equal(KEYBOARD_PRESETS.wasd.label, "WASD");
  assert.equal(KEYBOARD_PRESETS.arrows.label, "Стрелки");
  assert.equal(KEYBOARD_PRESETS.custom.label, "Своя");
});

test("WASD preset includes movement and action buttons", () => {
  const buttons = KEYBOARD_PRESETS.wasd.buttons;
  assert.ok(buttons.length >= 8);
  const codes = new Set(buttons.map((b) => b.code));
  assert.ok(codes.has("KeyW"));
  assert.ok(codes.has("KeyA"));
  assert.ok(codes.has("KeyS"));
  assert.ok(codes.has("KeyD"));
  assert.ok(codes.has("Space"));
});

test("custom preset starts empty for user-defined layout", () => {
  assert.deepEqual(KEYBOARD_PRESETS.custom.buttons, []);
});
