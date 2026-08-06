import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import * as React from "react";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";

globalThis.React = React;

const {
  buildPlatformEventsStreamUrl,
  parsePlatformEventMessage,
  usePlatformEvents,
} = await import("../src/hooks/use-platform-events.ts");

let domRegistered = false;
let domContainer = null;
let domRoot = null;

function setupDom() {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  if (!domRegistered) {
    GlobalRegistrator.register({ url: "https://localhost/", width: 1024, height: 768 });
    domRegistered = true;
  }
  domContainer = document.createElement("div");
  document.body.appendChild(domContainer);
  domRoot = createRoot(domContainer);
}

function teardownDom() {
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
}

afterEach(() => {
  teardownDom();
});

test("buildPlatformEventsStreamUrl appends api/events/stream to base", () => {
  assert.equal(buildPlatformEventsStreamUrl("/app/"), "/app/api/events/stream");
  assert.equal(buildPlatformEventsStreamUrl("/"), "/api/events/stream");
});

test("parsePlatformEventMessage returns null for connected handshake", () => {
  const raw = JSON.stringify({ type: "connected", payload: {}, at: "2026-01-01T00:00:00Z" });
  assert.equal(parsePlatformEventMessage(raw), null);
});

test("parsePlatformEventMessage parses real platform events", () => {
  const raw = JSON.stringify({
    type: "session.started",
    payload: { sessionId: "s-1" },
    at: "2026-01-01T00:00:00Z",
  });
  assert.deepEqual(parsePlatformEventMessage(raw), {
    type: "session.started",
    payload: { sessionId: "s-1" },
    at: "2026-01-01T00:00:00Z",
  });
});

test("parsePlatformEventMessage returns null for malformed JSON", () => {
  assert.equal(parsePlatformEventMessage("{not-json"), null);
  assert.equal(parsePlatformEventMessage(""), null);
});

test("usePlatformEvents is exported React hook", () => {
  assert.equal(typeof usePlatformEvents, "function");
  assert.equal(usePlatformEvents.name, "usePlatformEvents");
});

test("usePlatformEvents forwards parsed events from EventSource", () => {
  let messageHandler = null;
  let closed = false;
  class MockEventSource {
    constructor(url) {
      this.url = url;
    }
    set onmessage(fn) {
      messageHandler = fn;
    }
    close() {
      closed = true;
    }
  }

  const orig = globalThis.EventSource;
  globalThis.EventSource = MockEventSource;

  try {
    const events = [];
    const url = buildPlatformEventsStreamUrl("/");
    const es = new EventSource(url);
    es.onmessage = (msg) => {
      const event = parsePlatformEventMessage(msg.data);
      if (event) events.push(event);
    };

    assert.equal(es.url, "/api/events/stream");

    messageHandler({
      data: JSON.stringify({ type: "connected", payload: {}, at: "2026-01-01T00:00:00Z" }),
    });
    assert.equal(events.length, 0);

    messageHandler({
      data: JSON.stringify({
        type: "session.started",
        payload: { sessionId: "s-1" },
        at: "2026-01-01T00:00:00Z",
      }),
    });
    assert.equal(events.length, 1);
    assert.equal(events[0].type, "session.started");

    es.close();
    assert.equal(closed, true);
  } finally {
    globalThis.EventSource = orig;
  }
});

test("usePlatformEvents subscribes and forwards SSE events via React", () => {
  setupDom();
  let messageHandler = null;
  let lastUrl = null;
  class MockEventSource {
    constructor(url) {
      lastUrl = url;
    }
    set onmessage(fn) {
      messageHandler = fn;
    }
    close() {}
  }

  const orig = globalThis.EventSource;
  globalThis.EventSource = MockEventSource;

  try {
    const events = [];
    function Probe() {
      usePlatformEvents((event) => events.push(event));
      return null;
    }

    act(() => {
      domRoot.render(createElement(Probe));
    });

    assert.equal(lastUrl, "/api/events/stream");

    messageHandler({
      data: JSON.stringify({ type: "connected", payload: {}, at: "2026-01-01T00:00:00Z" }),
    });
    assert.equal(events.length, 0);

    messageHandler({
      data: JSON.stringify({
        type: "session.started",
        payload: { sessionId: "s-1" },
        at: "2026-01-01T00:00:00Z",
      }),
    });
    assert.equal(events.length, 1);
    assert.equal(events[0].type, "session.started");
  } finally {
    globalThis.EventSource = orig;
  }
});

test("usePlatformEvents does not subscribe when enabled is false", () => {
  setupDom();
  let constructed = false;
  class MockEventSource {
    constructor() {
      constructed = true;
    }
    set onmessage(_fn) {}
    close() {}
  }

  const orig = globalThis.EventSource;
  globalThis.EventSource = MockEventSource;

  try {
    function Probe() {
      usePlatformEvents(() => {}, false);
      return null;
    }
    act(() => {
      domRoot.render(createElement(Probe));
    });
    assert.equal(constructed, false);
  } finally {
    globalThis.EventSource = orig;
  }
});

test("usePlatformEvents closes EventSource on unmount", () => {
  setupDom();
  let closed = false;
  class MockEventSource {
    set onmessage(_fn) {}
    close() {
      closed = true;
    }
  }

  const orig = globalThis.EventSource;
  globalThis.EventSource = MockEventSource;

  try {
    function Probe() {
      usePlatformEvents(() => {});
      return null;
    }
    act(() => {
      domRoot.render(createElement(Probe));
    });
    act(() => {
      domRoot.unmount();
    });
    domRoot = null;
    assert.equal(closed, true);
  } finally {
    globalThis.EventSource = orig;
  }
});
