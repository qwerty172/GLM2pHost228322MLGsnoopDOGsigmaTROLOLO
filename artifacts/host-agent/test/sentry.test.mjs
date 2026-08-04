import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";

/** Captured Sentry.init calls from the mocked optional dependency. */
let sentryInitCalls = [];

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "@sentry/electron/main") {
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

function resetEnv() {
  delete process.env.SENTRY_DSN;
  delete process.env.NODE_ENV;
  sentryInitCalls = [];
}

test("initSentryMain no-ops when SENTRY_DSN is unset", async () => {
  resetEnv();
  const { initSentryMain } = await importSentry();
  initSentryMain();
  assert.equal(sentryInitCalls.length, 0);
});

test("initSentryMain initializes Sentry with DSN and NODE_ENV", async () => {
  resetEnv();
  process.env.SENTRY_DSN = "https://key@sentry.io/1";
  process.env.NODE_ENV = "test";
  const { initSentryMain } = await importSentry();
  initSentryMain();
  assert.equal(sentryInitCalls.length, 1);
  assert.deepEqual(sentryInitCalls[0], {
    dsn: "https://key@sentry.io/1",
    environment: "test",
  });
});

test("initSentryMain defaults environment to production", async () => {
  resetEnv();
  process.env.SENTRY_DSN = "https://key@sentry.io/1";
  const { initSentryMain } = await importSentry();
  initSentryMain();
  assert.equal(sentryInitCalls.length, 1);
  assert.equal(sentryInitCalls[0].environment, "production");
});

test("initSentryMain swallows require errors for optional dependency", async () => {
  resetEnv();
  process.env.SENTRY_DSN = "https://key@sentry.io/1";

  const origLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === "@sentry/electron/main") {
      throw new Error("optional dependency missing");
    }
    return origLoad.apply(this, arguments);
  };

  try {
    const { initSentryMain } = await importSentry();
    assert.doesNotThrow(() => initSentryMain());
    assert.equal(sentryInitCalls.length, 0);
  } finally {
    Module._load = origLoad;
  }
});
