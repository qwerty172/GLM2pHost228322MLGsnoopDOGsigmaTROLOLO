import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

const {
  TOUCH_LAYOUT_STORAGE_KEY,
  DEFAULT_TOUCH_LAYOUT,
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

test("DEFAULT_TOUCH_LAYOUT defines all control positions", () => {
  const keys = [
    "stickLeft", "stickRight", "btnA", "btnB", "btnX", "btnY",
    "btnLB", "btnRB", "btnLT", "btnRT", "btnStart", "btnSelect",
  ];
  for (const key of keys) {
    assert.ok(DEFAULT_TOUCH_LAYOUT[key], `missing ${key}`);
    assert.equal(typeof DEFAULT_TOUCH_LAYOUT[key].x, "number");
    assert.equal(typeof DEFAULT_TOUCH_LAYOUT[key].y, "number");
  }
  assert.equal(DEFAULT_TOUCH_LAYOUT.btnA.x, 82);
  assert.equal(DEFAULT_TOUCH_LAYOUT.stickLeft.y, 58);
});

test("loadTouchLayout returns default when storage empty", () => {
  const layout = loadTouchLayout();
  assert.deepEqual(layout.stickLeft, DEFAULT_TOUCH_LAYOUT.stickLeft);
  assert.deepEqual(layout.btnA, DEFAULT_TOUCH_LAYOUT.btnA);
});

test("loadTouchLayout reads persisted layout", () => {
  const saved = { btnA: { x: 50, y: 50 } };
  storage.set(TOUCH_LAYOUT_STORAGE_KEY, JSON.stringify(saved));
  const layout = loadTouchLayout();
  assert.deepEqual(layout.btnA, { x: 50, y: 50 });
  assert.deepEqual(layout.stickLeft, DEFAULT_TOUCH_LAYOUT.stickLeft);
});

test("loadTouchLayout falls back to default on invalid JSON", () => {
  storage.set(TOUCH_LAYOUT_STORAGE_KEY, "{not-json");
  const layout = loadTouchLayout();
  assert.deepEqual(layout.stickLeft, DEFAULT_TOUCH_LAYOUT.stickLeft);
});

test("saveTouchLayout persists layout", () => {
  const custom = { ...DEFAULT_TOUCH_LAYOUT, btnB: { x: 10, y: 20 } };
  saveTouchLayout(custom);
  const raw = storage.get(TOUCH_LAYOUT_STORAGE_KEY);
  assert.ok(raw);
  const parsed = JSON.parse(raw);
  assert.deepEqual(parsed.btnB, { x: 10, y: 20 });
});
