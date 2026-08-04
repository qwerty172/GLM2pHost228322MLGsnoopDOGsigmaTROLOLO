import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";

const sentryInits = [];
const load = Module._load;

function installSentryMock() {
  Module._load = function (request, parent, isMain) {
    if (request === "@sentry/electron/main") {
      return {
        init: (opts) => {
          sentryInits.push(opts);
        },
      };
    }
    return load.apply(this, arguments);
  };
}

installSentryMock();

const { initSentryMain } = await import("../dist/main/main/sentry.js");

let savedDsn;
let savedNodeEnv;

beforeEach(() => {
  savedDsn = process.env.SENTRY_DSN;
  savedNodeEnv = process.env.NODE_ENV;
  sentryInits.length = 0;
  delete process.env.SENTRY_DSN;
});

afterEach(() => {
  if (savedDsn === undefined) delete process.env.SENTRY_DSN;
  else process.env.SENTRY_DSN = savedDsn;
  if (savedNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = savedNodeEnv;
});

test("initSentryMain is no-op when SENTRY_DSN is unset", () => {
  initSentryMain();
  assert.equal(sentryInits.length, 0);
});

test("initSentryMain calls Sentry.init when SENTRY_DSN is set", () => {
  process.env.SENTRY_DSN = "https://example@sentry.io/1";
  process.env.NODE_ENV = "test";
  initSentryMain();
  assert.equal(sentryInits.length, 1);
  assert.deepEqual(sentryInits[0], {
    dsn: "https://example@sentry.io/1",
    environment: "test",
  });
});

test("initSentryMain defaults environment to production when NODE_ENV unset", () => {
  process.env.SENTRY_DSN = "https://example@sentry.io/1";
  delete process.env.NODE_ENV;
  initSentryMain();
  assert.equal(sentryInits.length, 1);
  assert.equal(sentryInits[0].environment, "production");
});

test("initSentryMain swallows missing @sentry/electron/main", () => {
  Module._load = function (request, parent, isMain) {
    if (request === "@sentry/electron/main") {
      throw new Error("MODULE_NOT_FOUND");
    }
    return load.apply(this, arguments);
  };
  try {
    process.env.SENTRY_DSN = "https://example@sentry.io/1";
    assert.doesNotThrow(() => initSentryMain());
    assert.equal(sentryInits.length, 0);
  } finally {
    installSentryMock();
  }
});
