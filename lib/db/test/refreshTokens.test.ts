import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getTableColumns, getTableName } from "drizzle-orm";
import { refreshTokensTable } from "../src/schema/refreshTokens.ts";

describe("refreshTokensTable", () => {
  it("maps to refresh_tokens", () => {
    assert.equal(getTableName(refreshTokensTable), "refresh_tokens");
  });

  it("exposes refresh token columns", () => {
    const cols = getTableColumns(refreshTokensTable);
    assert.deepEqual(Object.keys(cols).sort(), [
      "createdAt",
      "expiresAt",
      "id",
      "revokedAt",
      "tokenHash",
      "userId",
      "userType",
    ]);
  });

  it("requires userId, userType, tokenHash and expiresAt", () => {
    const cols = getTableColumns(refreshTokensTable);
    assert.equal(cols.userId.notNull, true);
    assert.equal(cols.userType.notNull, true);
    assert.equal(cols.tokenHash.notNull, true);
    assert.equal(cols.expiresAt.notNull, true);
    assert.equal(cols.createdAt.notNull, true);
    assert.equal(cols.revokedAt.notNull, false);
  });
});
