import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getTableColumns, getTableName } from "drizzle-orm";
import { agentEventsTable } from "../src/schema/agentEvents.ts";

describe("agentEventsTable", () => {
  it("maps to agent_events", () => {
    assert.equal(getTableName(agentEventsTable), "agent_events");
  });

  it("exposes telemetry columns", () => {
    const cols = getTableColumns(agentEventsTable);
    assert.deepEqual(Object.keys(cols).sort(), [
      "agentVersion",
      "createdAt",
      "hostId",
      "id",
      "level",
      "message",
      "occurredAt",
    ]);
  });

  it("requires hostId, level and message", () => {
    const cols = getTableColumns(agentEventsTable);
    assert.equal(cols.hostId.notNull, true);
    assert.equal(cols.level.notNull, true);
    assert.equal(cols.message.notNull, true);
  });
});
