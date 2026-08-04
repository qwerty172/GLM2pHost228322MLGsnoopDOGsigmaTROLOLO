import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";

/** @type {{ calls: Array<{ dsn: string; environment: string }>; failRequire: boolean; failInit: boolean }} */
let sentryMock = {
  calls: [],
  failRequire: false,
  failInit: false,
};

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "@sentry/electron/main") {
    if (sentryMock.failRequire) throw new Error("sentry not installed");
    return {
      init: (opts) => {
        if (sentryMock.failInit) throw new Error("init failed");
        sentryMock.calls.push(opts);
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

function resetSentryMock() {
  sentryMock = { calls: [], failRequire: false, failInit: false };
}

test("initSentryMain is no-op when SENTRY_DSN unset", { concurrency: false }, async () => {
  resetSentryMock();
  const prev = process.env.SENTRY_DSN;
  delete process.env.SENTRY_DSN;
  try {
    const { initSentryMain } = await importSentry();
    initSentryMain();
    assert.equal(sentryMock.calls.length, 0);
  } finally {
    if (prev === undefined) delete process.env.SENTRY_DSN;
    else process.env.SENTRY_DSN = prev;
  }
});

test("initSentryMain calls Sentry.init with DSN and NODE_ENV", { concurrency: false }, async () => {
  resetSentryMock();
  const prevDsn = process.env.SENTRY_DSN;
  const prevEnv = process.env.NODE_ENV;
  process.env.SENTRY_DSN = "https://key@sentry.io/1";
  process.env.NODE_ENV = "test";
  try {
    const { initSentryMain } = await importSentry();
    initSentryMain();
    assert.equal(sentryMock.calls.length, 1);
    assert.deepEqual(sentryMock.calls[0], {
      dsn: "https://key@sentry.io/1",
      environment: "test",
    });
  } finally {
    if (prevDsn === undefined) delete process.env.SENTRY_DSN;
    else process.env.SENTRY_DSN = prevDsn;
    if (prevEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevEnv;
  }
});

test("initSentryMain defaults environment to production", { concurrency: false }, async () => {
  resetSentryMock();
  const prevDsn = process.env.SENTRY_DSN;
  const prevEnv = process.env.NODE_ENV;
  process.env.SENTRY_DSN = "https://key@sentry.io/2";
  delete process.env.NODE_ENV;
  try {
    const { initSentryMain } = await importSentry();
    initSentryMain();
    assert.equal(sentryMock.calls.length, 1);
    assert.equal(sentryMock.calls[0].environment, "production");
  } finally {
    if (prevDsn === undefined) delete process.env.SENTRY_DSN;
    else process.env.SENTRY_DSN = prevDsn;
    if (prevEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevEnv;
  }
});

test("initSentryMain swallows missing @sentry/electron dependency", { concurrency: false }, async () => {
  resetSentryMock();
  sentryMock.failRequire = true;
  const prevDsn = process.env.SENTRY_DSN;
  process.env.SENTRY_DSN = "https://key@sentry.io/3";
  try {
    const { initSentryMain } = await importSentry();
    assert.doesNotThrow(() => initSentryMain());
    assert.equal(sentryMock.calls.length, 0);
  } finally {
    if (prevDsn === undefined) delete process.env.SENTRY_DSN;
    else process.env.SENTRY_DSN = prevDsn;
  }
});

test("initSentryMain swallows Sentry.init errors", { concurrency: false }, async () => {
  resetSentryMock();
  sentryMock.failInit = true;
  const prevDsn = process.env.SENTRY_DSN;
  process.env.SENTRY_DSN = "https://key@sentry.io/4";
  try {
    const { initSentryMain } = await importSentry();
    assert.doesNotThrow(() => initSentryMain());
    assert.equal(sentryMock.calls.length, 0);
  } finally {
    if (prevDsn === undefined) delete process.env.SENTRY_DSN;
    else process.env.SENTRY_DSN = prevDsn;
  }
});
