import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getTableColumns, getTableName } from "drizzle-orm";
import { joinCodesTable } from "../src/schema/joinCodes.ts";

describe("joinCodesTable", () => {
  it("maps to join_codes", () => {
    assert.equal(getTableName(joinCodesTable), "join_codes");
  });

  it("exposes join code columns", () => {
    const cols = getTableColumns(joinCodesTable);
    assert.deepEqual(Object.keys(cols).sort(), [
      "code",
      "createdAt",
      "expiresAt",
      "id",
      "sessionId",
    ]);
  });

  it("requires code, sessionId and expiresAt", () => {
    const cols = getTableColumns(joinCodesTable);
    assert.equal(cols.code.notNull, true);
    assert.equal(cols.sessionId.notNull, true);
    assert.equal(cols.expiresAt.notNull, true);
    assert.equal(cols.createdAt.notNull, true);
  });
});
