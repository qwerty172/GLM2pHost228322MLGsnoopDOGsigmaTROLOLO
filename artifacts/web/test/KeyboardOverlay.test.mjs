import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import * as React from "react";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";

globalThis.React = React;

const {
  KEY_CATALOGUE,
  KEYBOARD_PRESETS,
  KEYBOARD_OVERLAY_STORAGE_KEY,
  loadKeyboardLayout,
  saveKeyboardLayout,
  KeyboardOverlay,
} = await import("../src/components/KeyboardOverlay.tsx");

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

function mountKeyboardOverlay(props) {
  if (!domRegistered) {
    GlobalRegistrator.register({ url: "https://localhost/", width: 1024, height: 768 });
    domRegistered = true;
    installStorageMock();
  }
  domContainer = document.createElement("div");
  document.body.appendChild(domContainer);
  domRoot = createRoot(domContainer);
  act(() => {
    domRoot.render(createElement(KeyboardOverlay, props));
  });
}

async function unmountKeyboardOverlay() {
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

function findKeyButton(label) {
  const spans = domContainer.querySelectorAll("span");
  for (const span of spans) {
    if (span.textContent === label && span.parentElement?.style?.position === "absolute") {
      return span.parentElement;
    }
  }
  return null;
}

function clickButton(text) {
  const buttons = domContainer.querySelectorAll("button");
  for (const btn of buttons) {
    if (btn.textContent?.includes(text)) return btn;
  }
  return null;
}

beforeEach(() => {
  installStorageMock();
});

afterEach(() => {
  // storage mock is reinstalled each beforeEach
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

test("KeyboardOverlay renders WASD keys and reports key input", async () => {
  const inputs = [];
  mountKeyboardOverlay({ onKeyInput: (key, code, action) => inputs.push({ key, code, action }) });

  const keyW = findKeyButton("W");
  assert.ok(keyW, "W key rendered");

  await act(async () => {
    pointer(keyW, "pointerdown");
    await new Promise((r) => requestAnimationFrame(r));
  });
  assert.ok(inputs.some((i) => i.action === "down" && i.code === "KeyW"), "KeyW down");

  await act(async () => {
    pointer(keyW, "pointerup");
    await new Promise((r) => requestAnimationFrame(r));
  });
  assert.ok(inputs.some((i) => i.action === "up" && i.code === "KeyW"), "KeyW up");

  await unmountKeyboardOverlay();
});

test("KeyboardOverlay double-tap sends alt key when configured", async () => {
  const inputs = [];
  mountKeyboardOverlay({ onKeyInput: (key, code, action) => inputs.push({ key, code, action }) });

  const keyE = findKeyButton("E");
  assert.ok(keyE, "E key with alt rendered");

  await act(async () => {
    pointer(keyE, "pointerdown");
    pointer(keyE, "pointerup");
    pointer(keyE, "pointerdown");
    await new Promise((r) => requestAnimationFrame(r));
  });
  const altDown = inputs.find((i) => i.action === "down" && i.code === "KeyF");
  assert.ok(altDown, "double-tap sends alt KeyF");

  await act(async () => {
    pointer(keyE, "pointerup");
  });

  await unmountKeyboardOverlay();
});

test("KeyboardOverlay renders wide Space button", async () => {
  mountKeyboardOverlay({ onKeyInput: () => {} });

  const space = findKeyButton("Space");
  assert.ok(space, "Space key rendered");
  assert.ok(parseFloat(space.style.width) > parseFloat(space.style.height), "Space is wide");

  await unmountKeyboardOverlay();
});

test("KeyboardOverlay editMode shows toolbar and higher opacity", async () => {
  mountKeyboardOverlay({ onKeyInput: () => {}, editMode: true });

  const overlay = domContainer.querySelector("div[style*='pointer-events: none']");
  assert.ok(overlay);
  assert.equal(overlay.style.opacity, "0.95");

  assert.ok(clickButton("Пресеты"), "presets button");
  assert.ok(clickButton("+ Клавиша"), "add key button");

  await unmountKeyboardOverlay();
});

test("KeyboardOverlay editMode drag updates position and persists", async () => {
  mountKeyboardOverlay({ onKeyInput: () => {}, editMode: true });

  const keyW = findKeyButton("W");
  assert.ok(keyW);
  const rect = keyW.getBoundingClientRect();

  await act(async () => {
    pointer(keyW, "pointerdown", { clientX: rect.left + 5, clientY: rect.top + 5 });
    pointer(keyW, "pointermove", { clientX: rect.left + 120, clientY: rect.top + 80 });
    pointer(keyW, "pointerup", { clientX: rect.left + 120, clientY: rect.top + 80 });
  });

  const raw = storage.get(KEYBOARD_OVERLAY_STORAGE_KEY);
  assert.ok(raw, "layout saved after drag");
  const parsed = JSON.parse(raw);
  const wBtn = parsed.buttons.find((b) => b.label === "W");
  assert.ok(wBtn);
  assert.notEqual(wBtn.pos.x, KEYBOARD_PRESETS.wasd.buttons.find((b) => b.label === "W").pos.x);

  await unmountKeyboardOverlay();
});

test("KeyboardOverlay editMode tap opens key editor panel", async () => {
  mountKeyboardOverlay({ onKeyInput: () => {}, editMode: true });

  const keyW = findKeyButton("W");
  const rect = keyW.getBoundingClientRect();

  await act(async () => {
    pointer(keyW, "pointerdown", { clientX: rect.left + 5, clientY: rect.top + 5 });
    pointer(keyW, "pointerup", { clientX: rect.left + 5, clientY: rect.top + 5 });
  });

  const heading = [...domContainer.querySelectorAll("span")].find((s) => s.textContent === "Настройка кнопки");
  assert.ok(heading, "editor panel opened");

  await unmountKeyboardOverlay();
});

test("KeyboardOverlay key editor saves size change", async () => {
  mountKeyboardOverlay({ onKeyInput: () => {}, editMode: true });

  const keyW = findKeyButton("W");
  const rect = keyW.getBoundingClientRect();
  await act(async () => {
    pointer(keyW, "pointerdown", { clientX: rect.left + 5, clientY: rect.top + 5 });
    pointer(keyW, "pointerup", { clientX: rect.left + 5, clientY: rect.top + 5 });
  });

  const sizeL = clickButton("L");
  assert.ok(sizeL);
  await act(async () => {
    sizeL.click();
  });

  const saveBtn = clickButton("Сохранить");
  assert.ok(saveBtn);
  await act(async () => {
    saveBtn.click();
  });

  const raw = storage.get(KEYBOARD_OVERLAY_STORAGE_KEY);
  const parsed = JSON.parse(raw);
  const wBtn = parsed.buttons.find((b) => b.label === "W");
  assert.equal(wBtn.size, 72, "size updated after save");

  await unmountKeyboardOverlay();
});

test("KeyboardOverlay key editor deletes button", async () => {
  mountKeyboardOverlay({ onKeyInput: () => {}, editMode: true });

  const keyW = findKeyButton("W");
  const rect = keyW.getBoundingClientRect();
  await act(async () => {
    pointer(keyW, "pointerdown", { clientX: rect.left + 5, clientY: rect.top + 5 });
    pointer(keyW, "pointerup", { clientX: rect.left + 5, clientY: rect.top + 5 });
  });

  const deleteBtn = clickButton("Удалить");
  assert.ok(deleteBtn);
  await act(async () => {
    deleteBtn.click();
  });

  assert.equal(findKeyButton("W"), null, "W removed after delete");

  await unmountKeyboardOverlay();
});

test("KeyboardOverlay preset picker applies arrows layout", async () => {
  mountKeyboardOverlay({ onKeyInput: () => {}, editMode: true });

  const presetsBtn = clickButton("Пресеты");
  await act(async () => {
    presetsBtn.click();
  });

  const arrowsBtn = clickButton("Стрелки");
  assert.ok(arrowsBtn);
  await act(async () => {
    arrowsBtn.click();
  });

  assert.ok(findKeyButton("↑"), "arrows preset applied");
  const raw = storage.get(KEYBOARD_OVERLAY_STORAGE_KEY);
  const parsed = JSON.parse(raw);
  assert.equal(parsed.preset, "arrows");

  await unmountKeyboardOverlay();
});

test("KeyboardOverlay add button creates new key and opens editor", async () => {
  mountKeyboardOverlay({ onKeyInput: () => {}, editMode: true });

  const addBtn = clickButton("+ Клавиша");
  await act(async () => {
    addBtn.click();
  });

  const heading = [...domContainer.querySelectorAll("span")].find((s) => s.textContent === "Настройка кнопки");
  assert.ok(heading, "editor opened for new key");

  const question = findKeyButton("?");
  assert.ok(question, "new key with ? label");

  await unmountKeyboardOverlay();
});

test("KeyboardOverlay key editor alt tab picks secondary key", async () => {
  mountKeyboardOverlay({ onKeyInput: () => {}, editMode: true });

  const keyW = findKeyButton("W");
  const rect = keyW.getBoundingClientRect();
  await act(async () => {
    pointer(keyW, "pointerdown", { clientX: rect.left + 5, clientY: rect.top + 5 });
    pointer(keyW, "pointerup", { clientX: rect.left + 5, clientY: rect.top + 5 });
  });

  const altTab = [...domContainer.querySelectorAll("button")].find((b) => b.textContent?.startsWith("×2 Клавиша"));
  assert.ok(altTab);
  await act(async () => {
    altTab.click();
  });

  const qKey = [...domContainer.querySelectorAll("button")].find((b) => b.textContent === "Q" && b.style.minWidth === "38px");
  assert.ok(qKey);
  await act(async () => {
    qKey.click();
  });

  const saveBtn = clickButton("Сохранить");
  await act(async () => {
    saveBtn.click();
  });

  const raw = storage.get(KEYBOARD_OVERLAY_STORAGE_KEY);
  const parsed = JSON.parse(raw);
  const wBtn = parsed.buttons.find((b) => b.label === "W");
  assert.equal(wBtn.altKey, "q");

  await unmountKeyboardOverlay();
});
