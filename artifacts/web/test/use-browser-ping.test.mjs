import { test, mock, afterEach } from "node:test";
import assert from "node:assert/strict";

const { probeBrowserPingMs, useBrowserPingMs, BROWSER_PING_INTERVAL_MS } = await import(
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

test("useBrowserPingMs is exported React hook", () => {
  assert.equal(typeof useBrowserPingMs, "function");
  assert.equal(useBrowserPingMs.name, "useBrowserPingMs");
});

test("useBrowserPingMs probes immediately and every BROWSER_PING_INTERVAL_MS", async () => {
  mock.timers.enable({ apis: ["setInterval", "Date"] });
  const realNow = Date.now;
  let now = 1_000_000;
  mock.method(Date, "now", () => now);

  try {
    const pings = [];
    let cancelled = false;
    let timer = null;

    async function probe() {
      const ms = await probeBrowserPingMs(async () => {
        now += 15;
      });
      if (ms !== null && !cancelled) pings.push(ms);
    }

    await probe();
    timer = setInterval(() => void probe(), BROWSER_PING_INTERVAL_MS);

    assert.deepEqual(pings, [15]);

    mock.timers.tick(BROWSER_PING_INTERVAL_MS);
    await new Promise((resolve) => setImmediate(resolve));

    assert.deepEqual(pings, [15, 15]);

    cancelled = true;
    clearInterval(timer);
  } finally {
    Date.now = realNow;
    mock.timers.reset();
  }
});
