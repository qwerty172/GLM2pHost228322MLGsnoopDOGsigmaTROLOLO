import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getTableColumns, getTableName } from "drizzle-orm";
import {
  refreshTokensTable,
  type RefreshToken,
} from "../src/schema/refreshTokens.ts";

function getRefreshTokenIndexes() {
  const syms = Object.getOwnPropertySymbols(refreshTokensTable);
  const builderSym = syms.find((s) => String(s).includes("ExtraConfigBuilder"));
  const colsSym = syms.find((s) => String(s).includes("ExtraConfigColumns"));
  return refreshTokensTable[builderSym](refreshTokensTable[colsSym]) as Array<{
    config: { name: string; unique?: boolean };
  }>;
}

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
    assert.equal(cols.tokenHash.isUnique, true);
    assert.equal(cols.expiresAt.notNull, true);
    assert.equal(cols.createdAt.notNull, true);
    assert.equal(cols.createdAt.hasDefault, true);
    assert.equal(cols.revokedAt.notNull, false);
  });

  it("defines user and expires indexes", () => {
    const indexes = getRefreshTokenIndexes();
    assert.equal(indexes[0].config.name, "refresh_tokens_user_idx");
    assert.equal(indexes[1].config.name, "refresh_tokens_expires_idx");
    assert.equal(indexes[0].config.unique, false);
  });

  it("exports RefreshToken row type", () => {
    const row: RefreshToken = {
      id: "00000000-0000-4000-8000-000000000001",
      userId: "00000000-0000-4000-8000-000000000002",
      userType: "player",
      tokenHash: "hash",
      expiresAt: new Date(),
      revokedAt: null,
      createdAt: new Date(),
    };
    assert.equal(row.userType, "player");
  });
});
