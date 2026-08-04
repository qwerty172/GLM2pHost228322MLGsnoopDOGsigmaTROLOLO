import { test, mock } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";

const load = Module._load;
let sentryInitCalls = [];
let sentryModuleAvailable = true;

Module._load = function (request, parent, isMain) {
  if (request === "@sentry/electron/main") {
    if (!sentryModuleAvailable) {
      throw new Error("optional dependency missing");
    }
    return {
      init: (opts) => sentryInitCalls.push(opts),
    };
  }
  return load.apply(this, arguments);
};

async function importSentry() {
  const url = new URL("../dist/main/main/sentry.js", import.meta.url);
  url.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  return import(url.href);
}

async function withEnv(vars, fn) {
  const prev = {};
  for (const [key, value] of Object.entries(vars)) {
    prev[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("initSentryMain is no-op when SENTRY_DSN unset", async () => {
  sentryInitCalls = [];
  await withEnv({ SENTRY_DSN: undefined }, async () => {
    const { initSentryMain } = await importSentry();
    initSentryMain();
    assert.equal(sentryInitCalls.length, 0);
  });
});

test("initSentryMain calls Sentry.init with dsn and NODE_ENV", async () => {
  sentryInitCalls = [];
  await withEnv({ SENTRY_DSN: "https://sentry.test/1", NODE_ENV: "test" }, async () => {
    const { initSentryMain } = await importSentry();
    initSentryMain();
    assert.equal(sentryInitCalls.length, 1);
    assert.deepEqual(sentryInitCalls[0], {
      dsn: "https://sentry.test/1",
      environment: "test",
    });
  });
});

test("initSentryMain defaults environment to production", async () => {
  sentryInitCalls = [];
  await withEnv({ SENTRY_DSN: "https://sentry.test/2", NODE_ENV: undefined }, async () => {
    const { initSentryMain } = await importSentry();
    initSentryMain();
    assert.equal(sentryInitCalls.length, 1);
    assert.equal(sentryInitCalls[0].environment, "production");
  });
});

test("initSentryMain swallows missing optional dependency", async () => {
  sentryInitCalls = [];
  sentryModuleAvailable = false;
  try {
    await withEnv({ SENTRY_DSN: "https://sentry.test/3" }, async () => {
      const { initSentryMain } = await importSentry();
      initSentryMain();
      assert.equal(sentryInitCalls.length, 0);
    });
  } finally {
    sentryModuleAvailable = true;
  }
});
