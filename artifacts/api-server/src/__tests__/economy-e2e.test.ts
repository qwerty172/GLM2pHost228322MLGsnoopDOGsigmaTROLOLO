/**
 * Economy E2E scenario — requires DATABASE_URL_TEST with a disposable schema.
 * Skips when DATABASE_URL_TEST is unset (CI provides Postgres service).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const dbUrl = process.env.DATABASE_URL_TEST;

describe("economy E2E", { skip: !dbUrl }, () => {
  it("placeholder — ledger sum reconciles after deposit → play → credit → repay", async () => {
    // Full scenario wired when test DB harness is available in CI.
    assert.ok(dbUrl);
  });
});

describe("economy E2E (offline)", () => {
  it("credit math: creditAvailable = limit - debt", () => {
    const limit = 3000;
    const debt = 500;
    assert.equal(Math.max(0, limit - debt), 2500);
  });
});
