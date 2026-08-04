// Unit tests for optional Sentry init in Electron main (sentry.ts).
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";

let sentryInitCalls = [];
let sentryShouldThrow = false;

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "@sentry/electron/main") {
    if (sentryShouldThrow) throw new Error("module not found");
    return {
      init: (opts) => {
        sentryInitCalls.push(opts);
      },
    };
  }
  return load.apply(this, arguments);
};

async function importSentry() {
  const url = new URL("../dist/main/main/sentry.js", import.meta.url);
  url.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  return import(url.href);
}

beforeEach(() => {
  sentryInitCalls = [];
  sentryShouldThrow = false;
  delete process.env.SENTRY_DSN;
  delete process.env.NODE_ENV;
});

test("initSentryMain is no-op when SENTRY_DSN unset", async () => {
  const { initSentryMain } = await importSentry();
  initSentryMain();
  assert.equal(sentryInitCalls.length, 0);
});

test("initSentryMain calls Sentry.init with DSN and NODE_ENV", async () => {
  process.env.SENTRY_DSN = "https://example@sentry.io/1";
  process.env.NODE_ENV = "development";
  const { initSentryMain } = await importSentry();
  initSentryMain();
  assert.equal(sentryInitCalls.length, 1);
  assert.deepEqual(sentryInitCalls[0], {
    dsn: "https://example@sentry.io/1",
    environment: "development",
  });
});

test("initSentryMain defaults environment to production", async () => {
  process.env.SENTRY_DSN = "https://example@sentry.io/1";
  const { initSentryMain } = await importSentry();
  initSentryMain();
  assert.equal(sentryInitCalls.length, 1);
  assert.equal(sentryInitCalls[0].environment, "production");
});

test("initSentryMain swallows missing @sentry/electron/main", async () => {
  sentryShouldThrow = true;
  process.env.SENTRY_DSN = "https://example@sentry.io/1";
  const { initSentryMain } = await importSentry();
  assert.doesNotThrow(() => initSentryMain());
  assert.equal(sentryInitCalls.length, 0);
});
