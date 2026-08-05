import { test } from "node:test";
import assert from "node:assert/strict";

const { PING_INTERVAL_MS, probeBrowserPingMs } = await import("../src/hooks/use-browser-ping.ts");

test("PING_INTERVAL_MS is 60 seconds", () => {
  assert.equal(PING_INTERVAL_MS, 60_000);
});

test("probeBrowserPingMs returns elapsed ms after ping resolves", async () => {
  const ms = await probeBrowserPingMs(async () => {
    await new Promise((r) => setTimeout(r, 15));
  });
  assert.ok(ms >= 10, `expected >=10ms, got ${ms}`);
});

test("probeBrowserPingMs propagates ping rejection", async () => {
  await assert.rejects(
    () => probeBrowserPingMs(async () => {
      throw new Error("network down");
    }),
    /network down/,
  );
});
