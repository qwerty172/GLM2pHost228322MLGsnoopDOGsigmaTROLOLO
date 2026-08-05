import { test } from "node:test";
import assert from "node:assert/strict";

const { KEY_CATALOGUE, KEYBOARD_PRESETS } = await import("../src/components/KeyboardOverlay.tsx");

test("KEY_CATALOGUE includes core movement keys", () => {
  const codes = new Set(KEY_CATALOGUE.map((entry) => entry.code));
  for (const code of ["KeyW", "KeyA", "KeyS", "KeyD", "Space", "ShiftLeft", "Escape"]) {
    assert.ok(codes.has(code), `missing ${code}`);
  }
});

test("KEY_CATALOGUE entries have label, key, and code", () => {
  for (const entry of KEY_CATALOGUE) {
    assert.equal(typeof entry.label, "string");
    assert.ok(entry.label.length > 0);
    assert.equal(typeof entry.key, "string");
    assert.equal(typeof entry.code, "string");
    assert.ok(entry.code.length > 0);
  }
});

test("KEYBOARD_PRESETS exposes wasd, arrows, and custom layouts", () => {
  assert.equal(KEYBOARD_PRESETS.wasd.label, "WASD");
  assert.equal(KEYBOARD_PRESETS.arrows.label, "Стрелки");
  assert.equal(KEYBOARD_PRESETS.custom.label, "Своя");
});

test("KEYBOARD_PRESETS wasd and arrows have draggable buttons", () => {
  for (const preset of ["wasd", "arrows"]) {
    const buttons = KEYBOARD_PRESETS[preset].buttons;
    assert.ok(buttons.length >= 5, `${preset} should include movement keys`);
    for (const btn of buttons) {
      assert.equal(typeof btn.id, "string");
      assert.equal(typeof btn.label, "string");
      assert.equal(typeof btn.key, "string");
      assert.equal(typeof btn.code, "string");
      assert.ok(btn.size > 0);
      assert.equal(typeof btn.pos.x, "number");
      assert.equal(typeof btn.pos.y, "number");
    }
  }
});

test("KEYBOARD_PRESETS custom starts empty", () => {
  assert.deepEqual(KEYBOARD_PRESETS.custom.buttons, []);
});
