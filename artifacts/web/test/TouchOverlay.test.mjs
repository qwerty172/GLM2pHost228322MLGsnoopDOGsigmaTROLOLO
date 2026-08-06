import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import * as React from "react";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";

globalThis.React = React;

const {
  TOUCH_OVERLAY_STORAGE_KEY,
  DEFAULT_TOUCH_LAYOUT,
  loadTouchLayout,
  saveTouchLayout,
  TouchOverlay,
} = await import("../src/components/TouchOverlay.tsx");

const storage = new Map();

function installStorageMock() {
  storage.clear();
  const mock = {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => {
      storage.set(key, String(value));
    },
    removeItem: (key) => {
      storage.delete(key);
    },
    clear: () => storage.clear(),
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: mock,
    writable: true,
    configurable: true,
  });
}

let domRegistered = false;
let domContainer = null;
let domRoot = null;

function mountTouchOverlay(props) {
  if (!domRegistered) {
    GlobalRegistrator.register({ url: "https://localhost/", width: 1024, height: 768 });
    domRegistered = true;
    installStorageMock();
  }
  domContainer = document.createElement("div");
  document.body.appendChild(domContainer);
  domRoot = createRoot(domContainer);
  act(() => {
    domRoot.render(createElement(TouchOverlay, props));
  });
}

async function unmountTouchOverlay() {
  if (domRoot) {
    domRoot.unmount();
    domRoot = null;
  }
  if (domContainer) {
    domContainer.remove();
    domContainer = null;
  }
  if (domRegistered) {
    await GlobalRegistrator.unregister();
    domRegistered = false;
  }
}

function pointer(el, type, opts = {}) {
  const rect = el.getBoundingClientRect();
  const clientX = opts.clientX ?? rect.left + rect.width / 2;
  const clientY = opts.clientY ?? rect.top + rect.height / 2;
  el.dispatchEvent(
    new window.PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: opts.pointerId ?? 1,
      clientX,
      clientY,
      ...opts,
    }),
  );
}

beforeEach(() => {
  installStorageMock();
});

afterEach(() => {
  // storage mock is reinstalled each beforeEach
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

test("TouchOverlay renders face buttons and reports gamepad input", async () => {
  const inputs = [];
  mountTouchOverlay({ onGamepadInput: (axes, buttons) => inputs.push({ axes, buttons }) });

  const btnA = domContainer.querySelector("[aria-label='Кнопка A']");
  assert.ok(btnA, "A button rendered");

  await act(async () => {
    pointer(btnA, "pointerdown");
    await new Promise((r) => requestAnimationFrame(r));
  });
  assert.ok(inputs.some((i) => i.buttons[0] === 1), "BTN_A pressed");

  await act(async () => {
    pointer(btnA, "pointerup");
    await new Promise((r) => requestAnimationFrame(r));
  });
  assert.ok(inputs.some((i) => i.buttons[0] === 0), "BTN_A released");

  await unmountTouchOverlay();
});

test("TouchOverlay face buttons B X Y send correct indices", async () => {
  const inputs = [];
  mountTouchOverlay({ onGamepadInput: (axes, buttons) => inputs.push({ axes, buttons }) });

  const labels = ["B", "X", "Y"];
  const indices = [1, 2, 3];
  for (let i = 0; i < labels.length; i++) {
    const btn = domContainer.querySelector(`[aria-label='Кнопка ${labels[i]}']`);
    assert.ok(btn, `${labels[i]} button`);
    await act(async () => {
      pointer(btn, "pointerdown");
      await new Promise((r) => requestAnimationFrame(r));
    });
    assert.equal(inputs.at(-1).buttons[indices[i]], 1);
    await act(async () => {
      pointer(btn, "pointerup");
    });
  }

  await unmountTouchOverlay();
});

test("TouchOverlay shoulder buttons LT LB RT RB report presses", async () => {
  const inputs = [];
  mountTouchOverlay({ onGamepadInput: (axes, buttons) => inputs.push({ axes, buttons }) });

  const labels = ["LT", "LB", "RT", "RB"];
  const indices = [6, 4, 7, 5];
  for (let i = 0; i < labels.length; i++) {
    const btn = domContainer.querySelector(`[aria-label='Кнопка ${labels[i]}']`);
    assert.ok(btn, labels[i]);
    await act(async () => {
      pointer(btn, "pointerdown");
      await new Promise((r) => requestAnimationFrame(r));
    });
    assert.equal(inputs.at(-1).buttons[indices[i]], 1);
    await act(async () => {
      pointer(btn, "pointerup");
    });
  }

  await unmountTouchOverlay();
});

test("TouchOverlay menu buttons Select and Start report presses", async () => {
  const inputs = [];
  mountTouchOverlay({ onGamepadInput: (axes, buttons) => inputs.push({ axes, buttons }) });

  const selectBtn = domContainer.querySelector("[aria-label='Кнопка ☰']");
  const startBtn = domContainer.querySelector("[aria-label='Кнопка ▶']");
  assert.ok(selectBtn);
  assert.ok(startBtn);

  await act(async () => {
    pointer(selectBtn, "pointerdown");
    await new Promise((r) => requestAnimationFrame(r));
  });
  assert.equal(inputs.at(-1).buttons[8], 1);

  await act(async () => {
    pointer(startBtn, "pointerdown");
    await new Promise((r) => requestAnimationFrame(r));
  });
  assert.equal(inputs.at(-1).buttons[9], 1);

  await unmountTouchOverlay();
});

test("TouchOverlay analog stick move updates axes", async () => {
  const inputs = [];
  mountTouchOverlay({ onGamepadInput: (axes, buttons) => inputs.push({ axes, buttons }) });

  const stick = domContainer.querySelector("[aria-label='Левый стик']");
  assert.ok(stick);
  const rect = stick.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  await act(async () => {
    pointer(stick, "pointerdown", { clientX: cx, clientY: cy });
    pointer(stick, "pointermove", { clientX: cx + 30, clientY: cy + 20 });
    await new Promise((r) => requestAnimationFrame(r));
  });
  const moved = inputs.at(-1);
  assert.ok(moved.axes[0] > 0, "axis 0 positive");
  assert.ok(moved.axes[1] > 0, "axis 1 positive");

  await act(async () => {
    pointer(stick, "pointerup");
    await new Promise((r) => requestAnimationFrame(r));
  });
  const released = inputs.at(-1);
  assert.equal(released.axes[0], 0);
  assert.equal(released.axes[1], 0);

  await unmountTouchOverlay();
});

test("TouchOverlay right stick updates camera axes", async () => {
  const inputs = [];
  mountTouchOverlay({ onGamepadInput: (axes, buttons) => inputs.push({ axes, buttons }) });

  const sticks = domContainer.querySelectorAll("[role='application']");
  assert.equal(sticks.length, 2, "two analog sticks");
  const rightStick = sticks[1];
  const rect = rightStick.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  await act(async () => {
    pointer(rightStick, "pointerdown", { clientX: cx, clientY: cy });
    pointer(rightStick, "pointermove", { clientX: cx - 25, clientY: cy - 15 });
    await new Promise((r) => requestAnimationFrame(r));
  });
  const moved = inputs.at(-1);
  assert.ok(moved.axes[2] < 0, "axis 2 negative");
  assert.ok(moved.axes[3] < 0, "axis 3 negative");

  await unmountTouchOverlay();
});

test("TouchOverlay editMode drags control and persists layout", async () => {
  mountTouchOverlay({ onGamepadInput: () => {}, editMode: true });

  const btnA = domContainer.querySelector("[aria-label='Кнопка A']");
  const wrapper = btnA.parentElement.parentElement;
  const startRect = wrapper.getBoundingClientRect();

  await act(async () => {
    pointer(wrapper, "pointerdown", {
      clientX: startRect.left + 10,
      clientY: startRect.top + 10,
    });
    pointer(wrapper, "pointermove", {
      clientX: startRect.left + 110,
      clientY: startRect.top + 60,
    });
    pointer(wrapper, "pointerup");
  });

  const raw = storage.get(TOUCH_OVERLAY_STORAGE_KEY);
  assert.ok(raw, "layout saved after drag");
  const parsed = JSON.parse(raw);
  assert.notDeepEqual(parsed.btnA, DEFAULT_TOUCH_LAYOUT.btnA);

  await unmountTouchOverlay();
});

test("TouchOverlay editMode uses higher opacity", async () => {
  mountTouchOverlay({ onGamepadInput: () => {}, editMode: true });

  const overlay = domContainer.firstElementChild;
  assert.equal(overlay.style.opacity, "0.9");

  await unmountTouchOverlay();
});
