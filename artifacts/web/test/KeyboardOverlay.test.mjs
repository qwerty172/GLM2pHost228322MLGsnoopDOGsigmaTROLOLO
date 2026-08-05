import { test } from "node:test";
import assert from "node:assert/strict";

const { KEY_CATALOGUE, KEYBOARD_PRESETS } = await import("../src/components/KeyboardOverlay.tsx");

test("KEY_CATALOGUE entries have label, key, and code", () => {
  assert.ok(KEY_CATALOGUE.length > 0);
  for (const entry of KEY_CATALOGUE) {
    assert.equal(typeof entry.label, "string");
    assert.ok(entry.label.length > 0);
    assert.equal(typeof entry.key, "string");
    assert.equal(typeof entry.code, "string");
    assert.ok(entry.code.length > 0);
  }
});

test("KEY_CATALOGUE codes are unique", () => {
  const codes = KEY_CATALOGUE.map((e) => e.code);
  assert.equal(new Set(codes).size, codes.length);
});

test("KEYBOARD_PRESETS includes wasd, arrows, and custom", () => {
  assert.ok(KEYBOARD_PRESETS.wasd);
  assert.ok(KEYBOARD_PRESETS.arrows);
  assert.ok(KEYBOARD_PRESETS.custom);
});

test("KEYBOARD_PRESETS arrows and custom have Russian labels", () => {
  assert.equal(KEYBOARD_PRESETS.arrows.label, "Стрелки");
  assert.equal(KEYBOARD_PRESETS.custom.label, "Своя");
});

test("KEYBOARD_PRESETS.wasd contains movement keys W A S D", () => {
  const keys = KEYBOARD_PRESETS.wasd.buttons.map((b) => b.key);
  assert.ok(keys.includes("w"));
  assert.ok(keys.includes("a"));
  assert.ok(keys.includes("s"));
  assert.ok(keys.includes("d"));
});

test("KEYBOARD_PRESETS.custom has no preset buttons", () => {
  assert.equal(KEYBOARD_PRESETS.custom.buttons.length, 0);
});

test("preset buttons have id, label, key, code, size, and pos", () => {
  for (const preset of Object.values(KEYBOARD_PRESETS)) {
    for (const btn of preset.buttons) {
      assert.equal(typeof btn.id, "string");
      assert.ok(btn.id.length > 0);
      assert.equal(typeof btn.label, "string");
      assert.equal(typeof btn.key, "string");
      assert.equal(typeof btn.code, "string");
      assert.equal(typeof btn.size, "number");
      assert.ok(btn.size > 0);
      assert.equal(typeof btn.pos.x, "number");
      assert.equal(typeof btn.pos.y, "number");
    }
  }
});
