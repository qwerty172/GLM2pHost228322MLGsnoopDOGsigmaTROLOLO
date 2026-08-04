import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";

/** @type {{ initCalls: Array<{ dsn: string; environment: string }>; failRequire: boolean }} */
const sentryMock = {
  initCalls: [],
  failRequire: false,
};

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "@sentry/electron/main") {
    if (sentryMock.failRequire) throw new Error("optional dependency missing");
    return {
      init: (opts) => {
        sentryMock.initCalls.push(opts);
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

async function withEnv(overrides, fn) {
  const saved = {};
  for (const key of ["SENTRY_DSN", "NODE_ENV"]) {
    saved[key] = process.env[key];
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  sentryMock.initCalls = [];
  sentryMock.failRequire = false;
  try {
    return await fn();
  } finally {
    for (const key of ["SENTRY_DSN", "NODE_ENV"]) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

test("initSentryMain is no-op when SENTRY_DSN unset", async () => {
  await withEnv({ SENTRY_DSN: undefined, NODE_ENV: undefined }, async () => {
    const { initSentryMain } = await importSentry();
    initSentryMain();
    assert.equal(sentryMock.initCalls.length, 0);
  });
});

test("initSentryMain initializes Sentry with DSN and production default", async () => {
  await withEnv({ SENTRY_DSN: "https://key@sentry.io/1", NODE_ENV: undefined }, async () => {
    const { initSentryMain } = await importSentry();
    initSentryMain();
    assert.equal(sentryMock.initCalls.length, 1);
    assert.deepEqual(sentryMock.initCalls[0], {
      dsn: "https://key@sentry.io/1",
      environment: "production",
    });
  });
});

test("initSentryMain uses NODE_ENV when set", async () => {
  await withEnv({ SENTRY_DSN: "https://key@sentry.io/2", NODE_ENV: "development" }, async () => {
    const { initSentryMain } = await importSentry();
    initSentryMain();
    assert.equal(sentryMock.initCalls.length, 1);
    assert.equal(sentryMock.initCalls[0].environment, "development");
    assert.equal(sentryMock.initCalls[0].dsn, "https://key@sentry.io/2");
  });
});

test("initSentryMain swallows missing optional dependency", async () => {
  await withEnv({ SENTRY_DSN: "https://key@sentry.io/3", NODE_ENV: "test" }, async () => {
    sentryMock.failRequire = true;
    const { initSentryMain } = await importSentry();
    assert.doesNotThrow(() => initSentryMain());
    assert.equal(sentryMock.initCalls.length, 0);
  });
});
