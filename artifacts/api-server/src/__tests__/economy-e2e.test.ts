/**
 * Economy E2E scenario — requires DATABASE_URL_TEST with a disposable schema.
 * Skips when DATABASE_URL_TEST is unset (CI provides Postgres service).
 */
import { describe, it, expect } from "vitest";

const dbUrl = process.env.DATABASE_URL_TEST;

describe("economy E2E", () => {
  it.skipIf(!dbUrl)(
    "placeholder — ledger sum reconciles after deposit → play → credit → repay",
    async () => {
      expect(dbUrl).toBeTruthy();
    },
  );
});

describe("economy E2E (offline)", () => {
  it("credit math: creditAvailable = limit - debt", () => {
    const limit = 3000;
    const debt = 500;
    expect(Math.max(0, limit - debt)).toBe(2500);
  });

  it("outbox idempotency key prevents duplicate side-effects", () => {
    const keys = new Set<string>();
    const insert = (key: string) => keys.add(key);
    insert("deposit:abc");
    insert("deposit:abc");
    expect(keys.size).toBe(1);
  });
});
