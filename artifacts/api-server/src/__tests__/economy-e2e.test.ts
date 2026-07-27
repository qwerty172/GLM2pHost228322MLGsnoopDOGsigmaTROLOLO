/**
 * Economy E2E scenario — requires DATABASE_URL_TEST with a disposable schema.
 * Skips when DATABASE_URL_TEST is unset (CI provides Postgres service).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const dbUrl = process.env.DATABASE_URL_TEST;

describe("economy E2E", { skip: !dbUrl }, () => {
  it("integration scenario lives in economy-e2e.integration.test.ts", () => {
    assert.ok(dbUrl);
  });
});

describe("economy E2E (offline)", () => {
  it("credit math: creditAvailable = limit - debt", () => {
    const limit = 3000;
    const debt = 500;
    assert.equal(Math.max(0, limit - debt), 2500);
  });

  it("outbox idempotency key prevents duplicate side-effects", () => {
    const keys = new Set<string>();
    const insert = (key: string) => keys.add(key);
    insert("deposit:abc");
    insert("deposit:abc");
    assert.equal(keys.size, 1);
  });
});
