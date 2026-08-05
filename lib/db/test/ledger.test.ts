import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getTableColumns, getTableName } from "drizzle-orm";
import { ledgerTable } from "../src/schema/ledger.ts";

describe("ledgerTable", () => {
  it("maps to ledger", () => {
    assert.equal(getTableName(ledgerTable), "ledger");
  });

  it("exposes ledger columns", () => {
    const cols = getTableColumns(ledgerTable);
    assert.deepEqual(Object.keys(cols).sort(), [
      "bucket",
      "createdAt",
      "deltaLzt",
      "groupId",
      "id",
      "kind",
      "note",
      "ownerId",
      "ownerType",
      "refId",
      "refType",
    ]);
  });

  it("requires groupId, kind, ownerType, bucket and deltaLzt", () => {
    const cols = getTableColumns(ledgerTable);
    assert.equal(cols.groupId.notNull, true);
    assert.equal(cols.kind.notNull, true);
    assert.equal(cols.ownerType.notNull, true);
    assert.equal(cols.bucket.notNull, true);
    assert.equal(cols.deltaLzt.notNull, true);
    assert.equal(cols.createdAt.notNull, true);
    assert.equal(cols.ownerId.notNull, false);
    assert.equal(cols.refType.notNull, false);
    assert.equal(cols.refId.notNull, false);
    assert.equal(cols.note.notNull, false);
  });
});
