import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

const {
  TOUCH_OVERLAY_STORAGE_KEY,
  DEFAULT_TOUCH_LAYOUT,
  TOTAL_GAMEPAD_BUTTONS,
  TOTAL_GAMEPAD_AXES,
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

test("TOUCH_OVERLAY_STORAGE_KEY is touchLayout", () => {
  assert.equal(TOUCH_OVERLAY_STORAGE_KEY, "touchLayout");
});

test("TOTAL_GAMEPAD_BUTTONS and TOTAL_GAMEPAD_AXES match XInput layout", () => {
  assert.equal(TOTAL_GAMEPAD_BUTTONS, 10);
  assert.equal(TOTAL_GAMEPAD_AXES, 4);
});

test("DEFAULT_TOUCH_LAYOUT defines all control positions", () => {
  const keys = [
    "stickLeft",
    "stickRight",
    "btnA",
    "btnB",
    "btnX",
    "btnY",
    "btnLB",
    "btnRB",
    "btnLT",
    "btnRT",
    "btnStart",
    "btnSelect",
  ];
  for (const key of keys) {
    assert.ok(DEFAULT_TOUCH_LAYOUT[key], `missing ${key}`);
    assert.equal(typeof DEFAULT_TOUCH_LAYOUT[key].x, "number");
    assert.equal(typeof DEFAULT_TOUCH_LAYOUT[key].y, "number");
  }
});

test("loadTouchLayout returns default when storage empty", () => {
  const layout = loadTouchLayout();
  assert.deepEqual(layout, DEFAULT_TOUCH_LAYOUT);
});

test("loadTouchLayout merges persisted partial layout with defaults", () => {
  const saved = { btnA: { x: 50, y: 50 } };
  storage.set(TOUCH_OVERLAY_STORAGE_KEY, JSON.stringify(saved));
  const layout = loadTouchLayout();
  assert.deepEqual(layout.btnA, { x: 50, y: 50 });
  assert.deepEqual(layout.stickLeft, DEFAULT_TOUCH_LAYOUT.stickLeft);
});

test("loadTouchLayout falls back to default on invalid JSON", () => {
  storage.set(TOUCH_OVERLAY_STORAGE_KEY, "{not-json");
  const layout = loadTouchLayout();
  assert.deepEqual(layout, DEFAULT_TOUCH_LAYOUT);
});

test("saveTouchLayout persists full layout", () => {
  const custom = {
    ...DEFAULT_TOUCH_LAYOUT,
    btnB: { x: 70, y: 60 },
  };
  saveTouchLayout(custom);
  const raw = storage.get(TOUCH_OVERLAY_STORAGE_KEY);
  assert.ok(raw);
  const parsed = JSON.parse(raw);
  assert.deepEqual(parsed.btnB, { x: 70, y: 60 });
  assert.deepEqual(parsed.stickLeft, DEFAULT_TOUCH_LAYOUT.stickLeft);
});
