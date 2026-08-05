import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getTableColumns, getTableName } from "drizzle-orm";
import { agentPairingCodesTable } from "../src/schema/agentPairingCodes.ts";

describe("agentPairingCodesTable", () => {
  it("maps to agent_pairing_codes", () => {
    assert.equal(getTableName(agentPairingCodesTable), "agent_pairing_codes");
  });

  it("exposes pairing columns", () => {
    const cols = getTableColumns(agentPairingCodesTable);
    assert.deepEqual(Object.keys(cols).sort(), [
      "agentPubkey",
      "code",
      "createdAt",
      "expiresAt",
      "hostId",
      "id",
      "usedAt",
    ]);
  });

  it("requires hostId, code and expiresAt", () => {
    const cols = getTableColumns(agentPairingCodesTable);
    assert.equal(cols.hostId.notNull, true);
    assert.equal(cols.code.notNull, true);
    assert.equal(cols.expiresAt.notNull, true);
    assert.equal(cols.createdAt.notNull, true);
  });
});
