import { test } from "node:test";
import assert from "node:assert/strict";

const { KEY_CATALOGUE, KEYBOARD_PRESETS } = await import(
  "../src/components/KeyboardOverlay.tsx"
);

test("KEY_CATALOGUE has unique key codes", () => {
  const codes = KEY_CATALOGUE.map((e) => e.code);
  assert.equal(codes.length, new Set(codes).size);
});

test("KEY_CATALOGUE includes WASD movement keys", () => {
  const labels = new Set(KEY_CATALOGUE.map((e) => e.label));
  for (const key of ["W", "A", "S", "D"]) {
    assert.ok(labels.has(key), `missing ${key}`);
  }
});

test("KEY_CATALOGUE entries have label, key, and code", () => {
  for (const entry of KEY_CATALOGUE) {
    assert.ok(entry.label.length > 0);
    assert.ok(entry.key.length > 0);
    assert.ok(entry.code.length > 0);
  }
});

test("KEYBOARD_PRESETS defines wasd, arrows, and custom", () => {
  assert.ok(KEYBOARD_PRESETS.wasd);
  assert.ok(KEYBOARD_PRESETS.arrows);
  assert.ok(KEYBOARD_PRESETS.custom);
  assert.equal(KEYBOARD_PRESETS.wasd.label, "WASD");
  assert.equal(KEYBOARD_PRESETS.arrows.label, "Стрелки");
  assert.equal(KEYBOARD_PRESETS.custom.label, "Своя");
});

test("wasd preset includes movement and action keys", () => {
  const labels = KEYBOARD_PRESETS.wasd.buttons.map((b) => b.label);
  for (const key of ["W", "A", "S", "D", "Space", "E", "Tab", "Esc"]) {
    assert.ok(labels.includes(key), `wasd missing ${key}`);
  }
});

test("arrows preset uses arrow key codes", () => {
  const codes = KEYBOARD_PRESETS.arrows.buttons.map((b) => b.code);
  for (const code of ["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"]) {
    assert.ok(codes.includes(code), `arrows missing ${code}`);
  }
});

test("custom preset starts empty", () => {
  assert.deepEqual(KEYBOARD_PRESETS.custom.buttons, []);
});

test("preset buttons have valid layout fields", () => {
  for (const preset of Object.values(KEYBOARD_PRESETS)) {
    for (const btn of preset.buttons) {
      assert.ok(btn.id.length > 0);
      assert.ok(btn.size > 0);
      assert.ok(btn.pos.x >= 0 && btn.pos.y >= 0);
    }
  }
});
