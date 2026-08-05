import { test } from "node:test";
import assert from "node:assert/strict";

const { KEY_CATALOGUE, KEYBOARD_PRESETS } = await import("../src/components/KeyboardOverlay.tsx");

test("KEY_CATALOGUE has unique code values and required fields", () => {
  assert.ok(KEY_CATALOGUE.length > 20);

  const codes = new Set();
  for (const entry of KEY_CATALOGUE) {
    assert.ok(entry.label.length > 0);
    assert.ok(entry.key.length > 0);
    assert.ok(entry.code.length > 0);
    assert.equal(codes.has(entry.code), false, `duplicate code: ${entry.code}`);
    codes.add(entry.code);
  }

  const wasd = ["KeyW", "KeyA", "KeyS", "KeyD"];
  for (const code of wasd) {
    assert.ok(codes.has(code), `missing ${code}`);
  }
});

test("KEYBOARD_PRESETS covers wasd, arrows, and custom layouts", () => {
  assert.deepEqual(Object.keys(KEYBOARD_PRESETS).sort(), ["arrows", "custom", "wasd"]);

  assert.equal(KEYBOARD_PRESETS.wasd.label, "WASD");
  assert.equal(KEYBOARD_PRESETS.arrows.label, "Стрелки");
  assert.equal(KEYBOARD_PRESETS.custom.label, "Своя");
  assert.deepEqual(KEYBOARD_PRESETS.custom.buttons, []);

  for (const preset of ["wasd", "arrows"]) {
    const buttons = KEYBOARD_PRESETS[preset].buttons;
    assert.ok(buttons.length >= 6, `${preset} should have movement + action keys`);

    const ids = new Set();
    for (const btn of buttons) {
      assert.ok(btn.id.length > 0);
      assert.ok(btn.label.length > 0);
      assert.ok(btn.code.length > 0);
      assert.ok(btn.size > 0);
      assert.ok(btn.pos.x >= 0 && btn.pos.y >= 0);
      assert.equal(ids.has(btn.id), false);
      ids.add(btn.id);
    }
  }

  const wasdCodes = KEYBOARD_PRESETS.wasd.buttons.map((b) => b.code);
  assert.ok(wasdCodes.includes("KeyW"));
  assert.ok(wasdCodes.includes("KeyA"));
  assert.ok(wasdCodes.includes("Space"));
});
