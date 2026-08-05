import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getTableColumns, getTableName } from "drizzle-orm";
import { messages } from "../src/schema/messages.ts";

describe("messages", () => {
  it("maps to messages", () => {
    assert.equal(getTableName(messages), "messages");
  });

  it("exposes message columns", () => {
    const cols = getTableColumns(messages);
    assert.deepEqual(Object.keys(cols).sort(), [
      "content",
      "conversationId",
      "createdAt",
      "id",
      "role",
    ]);
  });

  it("requires conversationId, role, content and createdAt", () => {
    const cols = getTableColumns(messages);
    assert.equal(cols.conversationId.notNull, true);
    assert.equal(cols.role.notNull, true);
    assert.equal(cols.content.notNull, true);
    assert.equal(cols.createdAt.notNull, true);
  });
});
