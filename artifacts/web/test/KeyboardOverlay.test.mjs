import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

const {
  KEY_CATALOGUE,
  KEYBOARD_PRESETS,
  KEYBOARD_OVERLAY_STORAGE_KEY,
  loadKeyboardOverlayLayout,
  saveKeyboardOverlayLayout,
} = await import("../src/components/KeyboardOverlay.tsx");

const storage = new Map();

beforeEach(() => {
  storage.clear();
  globalThis.localStorage = {
    getItem: (k) => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
    clear: () => storage.clear(),
    key: () => null,
    length: 0,
  };
});

afterEach(() => {
  delete globalThis.localStorage;
});

test("KEY_CATALOGUE entries have unique codes", () => {
  const codes = KEY_CATALOGUE.map((e) => e.code);
  assert.equal(codes.length, new Set(codes).size);
  assert.ok(KEY_CATALOGUE.length >= 30);
});

test("KEYBOARD_PRESETS includes wasd, arrows and custom", () => {
  assert.equal(KEYBOARD_PRESETS.wasd.label, "WASD");
  assert.equal(KEYBOARD_PRESETS.arrows.label, "Стрелки");
  assert.equal(KEYBOARD_PRESETS.custom.label, "Своя");
  assert.equal(KEYBOARD_PRESETS.custom.buttons.length, 0);
});

test("wasd preset contains movement keys", () => {
  const labels = KEYBOARD_PRESETS.wasd.buttons.map((b) => b.label);
  assert.ok(labels.includes("W"));
  assert.ok(labels.includes("A"));
  assert.ok(labels.includes("S"));
  assert.ok(labels.includes("D"));
  assert.ok(labels.includes("Space"));
});

test("loadKeyboardOverlayLayout defaults to wasd when storage empty", () => {
  const layout = loadKeyboardOverlayLayout();
  assert.equal(layout.preset, "wasd");
  assert.ok(layout.buttons.length > 0);
});

test("saveKeyboardOverlayLayout persists and reloads layout", () => {
  const custom = {
    preset: "custom",
    buttons: [
      { id: "1", label: "Q", key: "q", code: "KeyQ", size: 44, pos: { x: 5, y: 5 } },
    ],
  };
  saveKeyboardOverlayLayout(custom.preset, custom.buttons);
  assert.ok(storage.has(KEYBOARD_OVERLAY_STORAGE_KEY));
  const loaded = loadKeyboardOverlayLayout();
  assert.equal(loaded.preset, "custom");
  assert.equal(loaded.buttons.length, 1);
  assert.equal(loaded.buttons[0].label, "Q");
});

test("loadKeyboardOverlayLayout ignores invalid JSON", () => {
  storage.set(KEYBOARD_OVERLAY_STORAGE_KEY, "{not-json");
  const layout = loadKeyboardOverlayLayout();
  assert.equal(layout.preset, "wasd");
  assert.ok(layout.buttons.length > 0);
});
