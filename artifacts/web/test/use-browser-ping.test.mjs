import { test, mock, afterEach } from "node:test";
import assert from "node:assert/strict";

const { probeBrowserPingMs, BROWSER_PING_INTERVAL_MS } = await import(
  "../src/hooks/use-browser-ping.ts"
);

afterEach(() => {
  mock.restoreAll();
});

test("BROWSER_PING_INTERVAL_MS is 60 seconds", () => {
  assert.equal(BROWSER_PING_INTERVAL_MS, 60_000);
});

test("probeBrowserPingMs returns elapsed ms when ping resolves", async () => {
  const realNow = Date.now;
  let now = 1_000_000;
  mock.method(Date, "now", () => now);

  try {
    const ms = await probeBrowserPingMs(async () => {
      now += 42;
    });
    assert.equal(ms, 42);
  } finally {
    Date.now = realNow;
  }
});

test("probeBrowserPingMs returns null when ping rejects", async () => {
  const ms = await probeBrowserPingMs(async () => {
    throw new Error("offline");
  });
  assert.equal(ms, null);
});
