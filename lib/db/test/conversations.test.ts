import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getTableColumns, getTableName } from "drizzle-orm";
import { conversations } from "../src/schema/conversations.ts";

describe("conversations", () => {
  it("maps to conversations", () => {
    assert.equal(getTableName(conversations), "conversations");
  });

  it("exposes conversation columns", () => {
    const cols = getTableColumns(conversations);
    assert.deepEqual(Object.keys(cols).sort(), ["createdAt", "id", "title"]);
  });

  it("requires title and createdAt", () => {
    const cols = getTableColumns(conversations);
    assert.equal(cols.title.notNull, true);
    assert.equal(cols.createdAt.notNull, true);
  });
});
