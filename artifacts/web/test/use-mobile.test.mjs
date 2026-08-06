import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import * as React from "react";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";

globalThis.React = React;

const {
  MOBILE_BREAKPOINT,
  isMobileViewport,
  mobileMediaQuery,
  useIsMobile,
} = await import("../src/hooks/use-mobile.tsx");

let domRegistered = false;
let domContainer = null;
let domRoot = null;

function mountUseIsMobile(innerWidth) {
  if (!domRegistered) {
    GlobalRegistrator.register({ url: "https://localhost/", width: innerWidth, height: 768 });
    domRegistered = true;
  }
  Object.defineProperty(window, "innerWidth", {
    value: innerWidth,
    writable: true,
    configurable: true,
  });

  let mobile = null;
  function Probe() {
    mobile = useIsMobile();
    return null;
  }

  domContainer = document.createElement("div");
  document.body.appendChild(domContainer);
  domRoot = createRoot(domContainer);
  act(() => {
    domRoot.render(createElement(Probe));
  });

  return {
    get: () => mobile,
    setWidth: (width) => {
      Object.defineProperty(window, "innerWidth", {
        value: width,
        writable: true,
        configurable: true,
      });
    },
  };
}

afterEach(() => {
  if (domRoot) {
    act(() => {
      domRoot.unmount();
    });
    domRoot = null;
  }
  if (domContainer) {
    domContainer.remove();
    domContainer = null;
  }
});

test("MOBILE_BREAKPOINT is 768", () => {
  assert.equal(MOBILE_BREAKPOINT, 768);
});

test("mobileMediaQuery matches max-width 767px", () => {
  assert.equal(mobileMediaQuery(), "(max-width: 767px)");
});

test("isMobileViewport is true below breakpoint", () => {
  assert.equal(isMobileViewport(0), true);
  assert.equal(isMobileViewport(767), true);
});

test("isMobileViewport is false at or above breakpoint", () => {
  assert.equal(isMobileViewport(768), false);
  assert.equal(isMobileViewport(1024), false);
});

test("useIsMobile returns false for desktop viewport", () => {
  const { get } = mountUseIsMobile(1024);
  assert.equal(get(), false);
});

test("useIsMobile returns true for mobile viewport", () => {
  const { get } = mountUseIsMobile(375);
  assert.equal(get(), true);
});

test("useIsMobile updates when matchMedia change fires", () => {
  const listeners = new Map();
  const origMatchMedia = window.matchMedia;
  window.matchMedia = (query) => ({
    media: query,
    addEventListener: (type, fn) => {
      listeners.set(type, fn);
    },
    removeEventListener: (type, fn) => {
      if (listeners.get(type) === fn) listeners.delete(type);
    },
  });

  try {
    const { get, setWidth } = mountUseIsMobile(1024);
    assert.equal(get(), false);

    setWidth(500);
    const onChange = listeners.get("change");
    assert.equal(typeof onChange, "function");
    act(() => {
      onChange();
    });
    assert.equal(get(), true);
  } finally {
    window.matchMedia = origMatchMedia;
  }
});

test("useIsMobile removes matchMedia listener on unmount", () => {
  const listeners = new Map();
  const origMatchMedia = window.matchMedia;
  window.matchMedia = (query) => ({
    media: query,
    addEventListener: (type, fn) => {
      listeners.set(type, fn);
    },
    removeEventListener: (type, fn) => {
      if (listeners.get(type) === fn) listeners.delete(type);
    },
  });

  try {
    mountUseIsMobile(1024);
    assert.equal(typeof listeners.get("change"), "function");
    act(() => {
      domRoot.unmount();
    });
    domRoot = null;
    assert.equal(listeners.has("change"), false);
  } finally {
    window.matchMedia = origMatchMedia;
  }
});
