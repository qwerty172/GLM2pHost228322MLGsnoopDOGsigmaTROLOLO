import { test } from "node:test";
import assert from "node:assert/strict";

const { KEY_CATALOGUE, KEYBOARD_PRESETS } = await import("../src/components/KeyboardOverlay.tsx");

test("KEY_CATALOGUE entries have unique codes and non-empty labels", () => {
  assert.ok(KEY_CATALOGUE.length >= 20);

  const codes = new Set();
  for (const entry of KEY_CATALOGUE) {
    assert.ok(entry.label.length > 0);
    assert.ok(entry.key.length > 0);
    assert.ok(entry.code.length > 0);
    assert.ok(!codes.has(entry.code), `duplicate code ${entry.code}`);
    codes.add(entry.code);
  }
});

test("KEYBOARD_PRESETS wasd and arrows include movement keys", () => {
  assert.equal(KEYBOARD_PRESETS.wasd.label, "WASD");
  assert.equal(KEYBOARD_PRESETS.arrows.label, "Стрелки");
  assert.equal(KEYBOARD_PRESETS.custom.label, "Своя");

  const wasdCodes = KEYBOARD_PRESETS.wasd.buttons.map((b) => b.code);
  assert.ok(wasdCodes.includes("KeyW"));
  assert.ok(wasdCodes.includes("KeyA"));
  assert.ok(wasdCodes.includes("KeyS"));
  assert.ok(wasdCodes.includes("KeyD"));

  const arrowCodes = KEYBOARD_PRESETS.arrows.buttons.map((b) => b.code);
  assert.ok(arrowCodes.includes("ArrowUp"));
  assert.ok(arrowCodes.includes("ArrowLeft"));
  assert.ok(arrowCodes.includes("ArrowDown"));
  assert.ok(arrowCodes.includes("ArrowRight"));
});

test("KEYBOARD_PRESET buttons have valid layout fields", () => {
  for (const name of ["wasd", "arrows"]) {
    const preset = KEYBOARD_PRESETS[name];
    assert.ok(preset.buttons.length > 0);
    for (const btn of preset.buttons) {
      assert.ok(btn.id.length > 0);
      assert.ok(btn.size > 0);
      assert.ok(btn.pos.x >= 0 && btn.pos.x <= 100);
      assert.ok(btn.pos.y >= 0 && btn.pos.y <= 100);
    }
  }

  assert.deepEqual(KEYBOARD_PRESETS.custom.buttons, []);
});
