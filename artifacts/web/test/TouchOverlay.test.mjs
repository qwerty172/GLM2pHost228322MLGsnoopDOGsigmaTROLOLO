import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

const {
  TOUCH_OVERLAY_STORAGE_KEY,
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

test("TOUCH_OVERLAY_STORAGE_KEY is touchLayout", () => {
  assert.equal(TOUCH_OVERLAY_STORAGE_KEY, "touchLayout");
});

test("DEFAULT_TOUCH_LAYOUT includes sticks and face buttons", () => {
  assert.ok(DEFAULT_TOUCH_LAYOUT.stickLeft);
  assert.ok(DEFAULT_TOUCH_LAYOUT.stickRight);
  assert.equal(DEFAULT_TOUCH_LAYOUT.btnA.x, 82);
  assert.equal(DEFAULT_TOUCH_LAYOUT.btnB.y, 68);
  assert.equal(DEFAULT_TOUCH_LAYOUT.btnStart.x, 52);
});

test("loadTouchLayout returns default when storage empty", () => {
  const layout = loadTouchLayout();
  assert.deepEqual(layout.stickLeft, DEFAULT_TOUCH_LAYOUT.stickLeft);
  assert.deepEqual(layout.btnA, DEFAULT_TOUCH_LAYOUT.btnA);
});

test("loadTouchLayout merges persisted partial layout", () => {
  storage.set(TOUCH_OVERLAY_STORAGE_KEY, JSON.stringify({ btnA: { x: 10, y: 20 } }));
  const layout = loadTouchLayout();
  assert.deepEqual(layout.btnA, { x: 10, y: 20 });
  assert.deepEqual(layout.btnB, DEFAULT_TOUCH_LAYOUT.btnB);
});

test("loadTouchLayout falls back to default on invalid JSON", () => {
  storage.set(TOUCH_OVERLAY_STORAGE_KEY, "{not-json");
  const layout = loadTouchLayout();
  assert.deepEqual(layout.stickLeft, DEFAULT_TOUCH_LAYOUT.stickLeft);
});

test("saveTouchLayout persists full layout", () => {
  const custom = { ...DEFAULT_TOUCH_LAYOUT, btnX: { x: 50, y: 50 } };
  saveTouchLayout(custom);
  const raw = storage.get(TOUCH_OVERLAY_STORAGE_KEY);
  assert.ok(raw);
  const parsed = JSON.parse(raw);
  assert.deepEqual(parsed.btnX, { x: 50, y: 50 });
});
