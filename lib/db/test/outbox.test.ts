import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getTableColumns, getTableName } from "drizzle-orm";
import { outboxTable } from "../src/schema/outbox.ts";

describe("outboxTable", () => {
  it("maps to outbox", () => {
    assert.equal(getTableName(outboxTable), "outbox");
  });

  it("exposes outbox columns", () => {
    const cols = getTableColumns(outboxTable);
    assert.deepEqual(Object.keys(cols).sort(), [
      "aggregateId",
      "aggregateType",
      "attempts",
      "createdAt",
      "eventType",
      "id",
      "idempotencyKey",
      "payload",
      "processedAt",
      "status",
    ]);
  });

  it("requires aggregate, event, payload, status and idempotencyKey", () => {
    const cols = getTableColumns(outboxTable);
    assert.equal(cols.aggregateType.notNull, true);
    assert.equal(cols.aggregateId.notNull, true);
    assert.equal(cols.eventType.notNull, true);
    assert.equal(cols.payload.notNull, true);
    assert.equal(cols.status.notNull, true);
    assert.equal(cols.attempts.notNull, true);
    assert.equal(cols.idempotencyKey.notNull, true);
    assert.equal(cols.createdAt.notNull, true);
    assert.equal(cols.processedAt.notNull, false);
  });
});
