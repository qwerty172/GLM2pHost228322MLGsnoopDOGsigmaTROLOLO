import { test } from "node:test";
import assert from "node:assert/strict";

const { KEY_CATALOGUE, KEYBOARD_PRESETS } = await import("../src/components/KeyboardOverlay.tsx");

test("KEY_CATALOGUE lists WASD and common game keys with codes", () => {
  assert.ok(KEY_CATALOGUE.length >= 30);
  const wasd = KEY_CATALOGUE.filter((k) => ["w", "a", "s", "d"].includes(k.key));
  assert.equal(wasd.length, 4);
  for (const entry of wasd) {
    assert.match(entry.code, /^Key[A-Z]$/);
  }
  assert.ok(KEY_CATALOGUE.some((k) => k.code === "Space"));
});

test("KEYBOARD_PRESETS includes wasd and arrows layouts", () => {
  assert.ok(KEYBOARD_PRESETS.wasd);
  assert.ok(KEYBOARD_PRESETS.arrows);
  assert.ok(KEYBOARD_PRESETS.custom);
  assert.equal(KEYBOARD_PRESETS.wasd.label, "WASD");
  assert.ok(KEYBOARD_PRESETS.wasd.buttons.length >= 4);
});

test("preset buttons use normalized viewport positions", () => {
  for (const preset of Object.values(KEYBOARD_PRESETS)) {
    for (const btn of preset.buttons) {
      assert.ok(btn.id);
      assert.ok(btn.label);
      assert.ok(btn.key);
      assert.ok(btn.code);
      assert.ok(btn.size > 0);
      assert.ok(btn.pos.x >= 0 && btn.pos.x <= 100);
      assert.ok(btn.pos.y >= 0 && btn.pos.y <= 100);
    }
  }
});
