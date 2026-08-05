import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

const {
  TOUCH_LAYOUT_STORAGE_KEY,
  DEFAULT_TOUCH_LAYOUT,
  TOUCH_BTN_A,
  TOUCH_BTN_START,
  TOUCH_TOTAL_BUTTONS,
  TOUCH_TOTAL_AXES,
  loadTouchLayout,
  saveTouchLayout,
} = await import("../src/components/TouchOverlay.tsx");

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

test("TOUCH_LAYOUT_STORAGE_KEY is touchLayout", () => {
  assert.equal(TOUCH_LAYOUT_STORAGE_KEY, "touchLayout");
});

test("gamepad constants match Web Gamepad / XInput layout", () => {
  assert.equal(TOUCH_BTN_A, 0);
  assert.equal(TOUCH_BTN_START, 9);
  assert.equal(TOUCH_TOTAL_BUTTONS, 10);
  assert.equal(TOUCH_TOTAL_AXES, 4);
});

test("DEFAULT_TOUCH_LAYOUT defines stick and face button positions", () => {
  assert.deepEqual(DEFAULT_TOUCH_LAYOUT.stickLeft, { x: 5, y: 58 });
  assert.deepEqual(DEFAULT_TOUCH_LAYOUT.btnA, { x: 82, y: 75 });
  assert.deepEqual(DEFAULT_TOUCH_LAYOUT.btnStart, { x: 52, y: 88 });
});

test("loadTouchLayout returns defaults when storage empty", () => {
  const layout = loadTouchLayout();
  assert.deepEqual(layout.stickLeft, DEFAULT_TOUCH_LAYOUT.stickLeft);
  assert.deepEqual(layout.btnY, DEFAULT_TOUCH_LAYOUT.btnY);
});

test("loadTouchLayout merges persisted partial layout", () => {
  storage.set(TOUCH_LAYOUT_STORAGE_KEY, JSON.stringify({ btnA: { x: 10, y: 20 } }));
  const layout = loadTouchLayout();
  assert.deepEqual(layout.btnA, { x: 10, y: 20 });
  assert.deepEqual(layout.stickLeft, DEFAULT_TOUCH_LAYOUT.stickLeft);
});

test("loadTouchLayout falls back to defaults on invalid JSON", () => {
  storage.set(TOUCH_LAYOUT_STORAGE_KEY, "{not-json");
  const layout = loadTouchLayout();
  assert.deepEqual(layout.stickLeft, DEFAULT_TOUCH_LAYOUT.stickLeft);
});

test("saveTouchLayout persists full layout state", () => {
  const custom = { ...DEFAULT_TOUCH_LAYOUT, btnB: { x: 50, y: 60 } };
  saveTouchLayout(custom);
  const raw = storage.get(TOUCH_LAYOUT_STORAGE_KEY);
  assert.ok(raw);
  const parsed = JSON.parse(raw);
  assert.deepEqual(parsed.btnB, { x: 50, y: 60 });
  assert.deepEqual(parsed.stickRight, DEFAULT_TOUCH_LAYOUT.stickRight);
});
