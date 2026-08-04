// Unit tests for optional Sentry init in Electron main (sentry.ts).
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";

const load = Module._load;
let sentryInitCalls = [];
let sentryLoadError = null;

function installSentryMock() {
  Module._load = function (request, parent, isMain) {
    if (request === "@sentry/electron/main") {
      if (sentryLoadError) throw sentryLoadError;
      return {
        init: (opts) => {
          sentryInitCalls.push(opts);
        },
      };
    }
    return load.apply(this, arguments);
  };
}

async function importSentry() {
  const url = new URL("../dist/main/main/sentry.js", import.meta.url);
  url.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  return import(url.href);
}

let originalEnv;

beforeEach(() => {
  sentryInitCalls = [];
  sentryLoadError = null;
  originalEnv = {
    SENTRY_DSN: process.env.SENTRY_DSN,
    NODE_ENV: process.env.NODE_ENV,
  };
  installSentryMock();
});

afterEach(() => {
  Module._load = load;
  if (originalEnv.SENTRY_DSN === undefined) delete process.env.SENTRY_DSN;
  else process.env.SENTRY_DSN = originalEnv.SENTRY_DSN;
  if (originalEnv.NODE_ENV === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalEnv.NODE_ENV;
});

test("initSentryMain is no-op when SENTRY_DSN is unset", async () => {
  delete process.env.SENTRY_DSN;
  const { initSentryMain } = await importSentry();
  initSentryMain();
  assert.equal(sentryInitCalls.length, 0);
});

test("initSentryMain calls Sentry.init with dsn and NODE_ENV", async () => {
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
  delete process.env.NODE_ENV;
  const { initSentryMain } = await importSentry();
  initSentryMain();
  assert.equal(sentryInitCalls.length, 1);
  assert.equal(sentryInitCalls[0].environment, "production");
});

test("initSentryMain swallows missing @sentry/electron/main", async () => {
  process.env.SENTRY_DSN = "https://example@sentry.io/1";
  sentryLoadError = new Error("optional dependency missing");
  const { initSentryMain } = await importSentry();
  assert.doesNotThrow(() => initSentryMain());
  assert.equal(sentryInitCalls.length, 0);
});
