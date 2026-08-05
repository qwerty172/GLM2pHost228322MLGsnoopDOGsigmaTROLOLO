import { test } from "node:test";
import assert from "node:assert/strict";

const { initSentry } = await import("../src/lib/sentry.ts");

test("initSentry resolves without error", async () => {
  await assert.doesNotReject(() => initSentry());
});

test("initSentry returns undefined (no-op stub)", async () => {
  assert.equal(await initSentry(), undefined);
});

test("initSentry can be called multiple times", async () => {
  await initSentry();
  await initSentry();
  assert.equal(await initSentry(), undefined);
});
