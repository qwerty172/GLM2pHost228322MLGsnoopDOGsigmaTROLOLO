import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

const {
  KEY_CATALOGUE,
  KEYBOARD_PRESETS,
  KEYBOARD_OVERLAY_STORAGE_KEY,
  loadKeyboardLayout,
  saveKeyboardLayout,
} = await import("../src/components/KeyboardOverlay.tsx");

const storage = new Map();

beforeEach(() => {
  storage.clear();
  globalThis.localStorage = {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => {
      storage.set(key, String(value));
    },
    removeItem: (key) => {
      storage.delete(key);
    },
  };
});

afterEach(() => {
  delete globalThis.localStorage;
});

test("KEYBOARD_OVERLAY_STORAGE_KEY is keyboardOverlayLayout_v1", () => {
  assert.equal(KEYBOARD_OVERLAY_STORAGE_KEY, "keyboardOverlayLayout_v1");
});

test("KEY_CATALOGUE includes WASD movement keys", () => {
  const codes = new Set(KEY_CATALOGUE.map((e) => e.code));
  assert.ok(codes.has("KeyW"));
  assert.ok(codes.has("KeyA"));
  assert.ok(codes.has("KeyS"));
  assert.ok(codes.has("KeyD"));
  assert.ok(codes.has("Space"));
});

test("KEYBOARD_PRESETS defines wasd, arrows and custom", () => {
  assert.equal(KEYBOARD_PRESETS.wasd.label, "WASD");
  assert.equal(KEYBOARD_PRESETS.arrows.label, "Стрелки");
  assert.equal(KEYBOARD_PRESETS.custom.label, "Своя");
  assert.ok(KEYBOARD_PRESETS.wasd.buttons.length > 0);
  assert.ok(KEYBOARD_PRESETS.arrows.buttons.length > 0);
  assert.deepEqual(KEYBOARD_PRESETS.custom.buttons, []);
});

test("loadKeyboardLayout returns wasd preset when storage empty", () => {
  const layout = loadKeyboardLayout();
  assert.equal(layout.preset, "wasd");
  assert.ok(layout.buttons.length > 0);
  assert.equal(layout.buttons[0].code, KEYBOARD_PRESETS.wasd.buttons[0].code);
});

test("loadKeyboardLayout reads persisted layout", () => {
  const saved = { preset: "arrows", buttons: [{ id: "1", label: "↑", key: "ArrowUp", code: "ArrowUp", size: 52, pos: { x: 1, y: 2 } }] };
  storage.set(KEYBOARD_OVERLAY_STORAGE_KEY, JSON.stringify(saved));
  const layout = loadKeyboardLayout();
  assert.equal(layout.preset, "arrows");
  assert.equal(layout.buttons.length, 1);
  assert.equal(layout.buttons[0].code, "ArrowUp");
});

test("loadKeyboardLayout falls back to wasd on invalid JSON", () => {
  storage.set(KEYBOARD_OVERLAY_STORAGE_KEY, "{not-json");
  const layout = loadKeyboardLayout();
  assert.equal(layout.preset, "wasd");
  assert.ok(layout.buttons.length > 0);
});

test("saveKeyboardLayout persists preset and buttons", () => {
  const buttons = [{ id: "x", label: "Q", key: "q", code: "KeyQ", size: 40, pos: { x: 5, y: 5 } }];
  saveKeyboardLayout("custom", buttons);
  const raw = storage.get(KEYBOARD_OVERLAY_STORAGE_KEY);
  assert.ok(raw);
  const parsed = JSON.parse(raw);
  assert.equal(parsed.preset, "custom");
  assert.equal(parsed.buttons[0].code, "KeyQ");
});
