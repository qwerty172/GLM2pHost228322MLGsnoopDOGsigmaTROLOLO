import { test } from "node:test";
import assert from "node:assert/strict";

const {
  KEY_CATALOGUE,
  KEYBOARD_PRESETS,
  KEYBOARD_OVERLAY_STORAGE_KEY,
  KEYBOARD_DOUBLE_TAP_MS,
  resolveKeyTap,
  clampOverlayPos,
  isWideKeyButton,
  loadKeyboardOverlayLayout,
  saveKeyboardOverlayLayout,
} = await import("../src/components/KeyboardOverlay.tsx");

test("KEY_CATALOGUE has unique codes and includes WASD", () => {
  const codes = KEY_CATALOGUE.map((e) => e.code);
  assert.equal(new Set(codes).size, codes.length);
  for (const code of ["KeyW", "KeyA", "KeyS", "KeyD"]) {
    assert.ok(codes.includes(code), `missing ${code}`);
  }
});

test("KEYBOARD_PRESETS wasd has movement keys, custom is empty", () => {
  assert.ok(KEYBOARD_PRESETS.wasd.buttons.length >= 8);
  assert.equal(KEYBOARD_PRESETS.custom.buttons.length, 0);
  assert.equal(KEYBOARD_PRESETS.arrows.label, "Стрелки");
});

test("resolveKeyTap uses primary key on first tap", () => {
  const btn = { key: "e", code: "KeyE", altKey: "f", altCode: "KeyF" };
  const tap = resolveKeyTap(btn, 0, 1000);
  assert.deepEqual(tap, { key: "e", code: "KeyE", isDouble: false });
});

test("resolveKeyTap uses alt key within double-tap window", () => {
  const btn = { key: "e", code: "KeyE", altKey: "f", altCode: "KeyF" };
  const tap = resolveKeyTap(btn, 900, 1000, KEYBOARD_DOUBLE_TAP_MS);
  assert.deepEqual(tap, { key: "f", code: "KeyF", isDouble: true });
});

test("resolveKeyTap ignores alt when gap exceeds window", () => {
  const btn = { key: "e", code: "KeyE", altKey: "f", altCode: "KeyF" };
  const tap = resolveKeyTap(btn, 0, KEYBOARD_DOUBLE_TAP_MS + 1);
  assert.equal(tap.isDouble, false);
  assert.equal(tap.key, "e");
});

test("clampOverlayPos keeps coords inside viewport bounds", () => {
  assert.deepEqual(clampOverlayPos(-5, 50), { x: 0, y: 50 });
  assert.deepEqual(clampOverlayPos(100, -1), { x: 92, y: 0 });
  assert.deepEqual(clampOverlayPos(50, 70), { x: 50, y: 70 });
});

test("isWideKeyButton detects wide labels at large sizes", () => {
  assert.equal(isWideKeyButton({ size: 56, label: "Space" }), true);
  assert.equal(isWideKeyButton({ size: 56, label: "W" }), false);
  assert.equal(isWideKeyButton({ size: 44, label: "Space" }), false);
});

test("loadKeyboardOverlayLayout defaults to wasd preset", () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
  };
  try {
    const layout = loadKeyboardOverlayLayout();
    assert.equal(layout.preset, "wasd");
    assert.ok(layout.buttons.length > 0);
  } finally {
    delete globalThis.localStorage;
  }
});

test("saveKeyboardOverlayLayout persists preset and buttons", () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
  };
  try {
    const buttons = [{ id: "1", label: "W", key: "w", code: "KeyW", size: 52, pos: { x: 1, y: 2 } }];
    saveKeyboardOverlayLayout("custom", buttons);
    const raw = store.get(KEYBOARD_OVERLAY_STORAGE_KEY);
    assert.ok(raw);
    assert.deepEqual(JSON.parse(raw), { preset: "custom", buttons });
  } finally {
    delete globalThis.localStorage;
  }
});
