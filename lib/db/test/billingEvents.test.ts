import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getTableColumns, getTableName } from "drizzle-orm";
import { billingEventsTable } from "../src/schema/billingEvents.ts";

describe("billingEventsTable", () => {
  it("maps to billing_events", () => {
    assert.equal(getTableName(billingEventsTable), "billing_events");
  });

  it("exposes billing columns", () => {
    const cols = getTableColumns(billingEventsTable);
    assert.deepEqual(Object.keys(cols).sort(), [
      "billedAt",
      "bucket",
      "hostCreditLzt",
      "hostId",
      "id",
      "kind",
      "minutes",
      "playerDebitLzt",
      "playerId",
      "quotaId",
      "sessionId",
    ]);
  });

  it("requires sessionId, hostId, minutes, bucket and kind", () => {
    const cols = getTableColumns(billingEventsTable);
    assert.equal(cols.sessionId.notNull, true);
    assert.equal(cols.hostId.notNull, true);
    assert.equal(cols.minutes.notNull, true);
    assert.equal(cols.bucket.notNull, true);
    assert.equal(cols.kind.notNull, true);
    assert.equal(cols.billedAt.notNull, true);
    assert.equal(cols.playerId.notNull, false);
    assert.equal(cols.quotaId.notNull, false);
  });
});
