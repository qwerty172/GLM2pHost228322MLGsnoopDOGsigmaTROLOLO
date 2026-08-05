import { test } from "node:test";
import assert from "node:assert/strict";

const {
  KEY_CATALOGUE,
  KEYBOARD_PRESETS,
  KEYBOARD_OVERLAY_STORAGE_KEY,
  loadKeyboardOverlayLayout,
  saveKeyboardOverlayLayout,
} = await import("../src/components/KeyboardOverlay.tsx");

test("KEYBOARD_OVERLAY_STORAGE_KEY is keyboardOverlayLayout_v1", () => {
  assert.equal(KEYBOARD_OVERLAY_STORAGE_KEY, "keyboardOverlayLayout_v1");
});

test("KEY_CATALOGUE has unique codes and covers movement keys", () => {
  const codes = KEY_CATALOGUE.map((k) => k.code);
  assert.equal(codes.length, new Set(codes).size);

  for (const code of ["KeyW", "KeyA", "KeyS", "KeyD", "Space", "ArrowUp", "Escape"]) {
    assert.ok(KEY_CATALOGUE.some((k) => k.code === code), `missing ${code}`);
  }
});

test("KEYBOARD_PRESETS defines wasd, arrows and empty custom", () => {
  assert.equal(KEYBOARD_PRESETS.wasd.label, "WASD");
  assert.equal(KEYBOARD_PRESETS.arrows.label, "Стрелки");
  assert.equal(KEYBOARD_PRESETS.custom.label, "Своя");
  assert.ok(KEYBOARD_PRESETS.wasd.buttons.length >= 8);
  assert.ok(KEYBOARD_PRESETS.arrows.buttons.length >= 6);
  assert.deepEqual(KEYBOARD_PRESETS.custom.buttons, []);
});

test("loadKeyboardOverlayLayout returns wasd default when storage empty", () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  };
  try {
    const layout = loadKeyboardOverlayLayout();
    assert.equal(layout.preset, "wasd");
    assert.ok(layout.buttons.length > 0);
    assert.equal(layout.buttons[0].key, KEYBOARD_PRESETS.wasd.buttons[0].key);
  } finally {
    delete globalThis.localStorage;
  }
});

test("saveKeyboardOverlayLayout persists preset and buttons", () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  };
  try {
    const buttons = [{ id: "1", label: "Q", key: "q", code: "KeyQ", size: 44, pos: { x: 1, y: 2 } }];
    saveKeyboardOverlayLayout("custom", buttons);
    const raw = store.get(KEYBOARD_OVERLAY_STORAGE_KEY);
    assert.ok(raw);
    const parsed = JSON.parse(raw);
    assert.equal(parsed.preset, "custom");
    assert.equal(parsed.buttons[0].label, "Q");
  } finally {
    delete globalThis.localStorage;
  }
});
