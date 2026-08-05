import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getTableColumns, getTableName } from "drizzle-orm";
import { systemAccountsTable } from "../src/schema/systemAccounts.ts";

describe("systemAccountsTable", () => {
  it("maps to system_accounts", () => {
    assert.equal(getTableName(systemAccountsTable), "system_accounts");
  });

  it("exposes system account columns", () => {
    const cols = getTableColumns(systemAccountsTable);
    assert.deepEqual(Object.keys(cols).sort(), ["balanceLzt", "key", "updatedAt"]);
  });

  it("requires key, balanceLzt and updatedAt", () => {
    const cols = getTableColumns(systemAccountsTable);
    assert.equal(cols.key.notNull, true);
    assert.equal(cols.balanceLzt.notNull, true);
    assert.equal(cols.updatedAt.notNull, true);
  });
});
