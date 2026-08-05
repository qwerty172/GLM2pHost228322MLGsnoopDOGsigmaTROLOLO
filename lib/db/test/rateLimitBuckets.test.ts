import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getTableColumns, getTableName } from "drizzle-orm";
import {
  rateLimitBucketsTable,
  rateLimitFailuresTable,
} from "../src/schema/rateLimitBuckets.ts";

describe("rateLimitBucketsTable", () => {
  it("maps to rate_limit_buckets", () => {
    assert.equal(getTableName(rateLimitBucketsTable), "rate_limit_buckets");
  });

  it("exposes bucket columns", () => {
    const cols = getTableColumns(rateLimitBucketsTable);
    assert.deepEqual(Object.keys(cols).sort(), [
      "key",
      "max",
      "tokens",
      "updatedAt",
      "windowMs",
    ]);
  });

  it("requires key, tokens, window and max", () => {
    const cols = getTableColumns(rateLimitBucketsTable);
    assert.equal(cols.key.notNull, true);
    assert.equal(cols.tokens.notNull, true);
    assert.equal(cols.updatedAt.notNull, true);
    assert.equal(cols.windowMs.notNull, true);
    assert.equal(cols.max.notNull, true);
  });
});

describe("rateLimitFailuresTable", () => {
  it("maps to rate_limit_failures", () => {
    assert.equal(getTableName(rateLimitFailuresTable), "rate_limit_failures");
  });

  it("exposes failure columns", () => {
    const cols = getTableColumns(rateLimitFailuresTable);
    assert.deepEqual(Object.keys(cols).sort(), [
      "consecutiveFailures",
      "key",
      "lockedUntil",
      "updatedAt",
    ]);
  });

  it("requires key and updatedAt; lockedUntil optional", () => {
    const cols = getTableColumns(rateLimitFailuresTable);
    assert.equal(cols.key.notNull, true);
    assert.equal(cols.consecutiveFailures.notNull, true);
    assert.equal(cols.updatedAt.notNull, true);
    assert.equal(cols.lockedUntil.notNull, false);
  });
});
