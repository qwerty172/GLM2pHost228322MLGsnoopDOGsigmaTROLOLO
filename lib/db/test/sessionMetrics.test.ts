import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getTableColumns, getTableName } from "drizzle-orm";
import { sessionMetricsTable } from "../src/schema/sessionMetrics.ts";

describe("sessionMetricsTable", () => {
  it("maps to session_metrics", () => {
    assert.equal(getTableName(sessionMetricsTable), "session_metrics");
  });

  it("exposes session metric columns", () => {
    const cols = getTableColumns(sessionMetricsTable);
    assert.deepEqual(Object.keys(cols).sort(), [
      "bitrateKbps",
      "fps",
      "framesDropped",
      "iceCandidateType",
      "id",
      "jitterMs",
      "packetLossPct",
      "role",
      "rttMs",
      "sampledAt",
      "sessionId",
    ]);
  });

  it("requires sessionId, role and sampledAt; metrics optional", () => {
    const cols = getTableColumns(sessionMetricsTable);
    assert.equal(cols.sessionId.notNull, true);
    assert.equal(cols.role.notNull, true);
    assert.equal(cols.sampledAt.notNull, true);
    assert.equal(cols.rttMs.notNull, false);
    assert.equal(cols.bitrateKbps.notNull, false);
    assert.equal(cols.fps.notNull, false);
    assert.equal(cols.packetLossPct.notNull, false);
    assert.equal(cols.framesDropped.notNull, false);
    assert.equal(cols.iceCandidateType.notNull, false);
    assert.equal(cols.jitterMs.notNull, false);
  });
});
