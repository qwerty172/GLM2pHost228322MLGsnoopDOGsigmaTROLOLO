import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getTableColumns, getTableName } from "drizzle-orm";
import { quotaSessionsTable } from "../src/schema/quotaSessions.ts";

describe("quotaSessionsTable", () => {
  it("maps to quota_sessions", () => {
    assert.equal(getTableName(quotaSessionsTable), "quota_sessions");
  });

  it("exposes quota session columns", () => {
    const cols = getTableColumns(quotaSessionsTable);
    assert.deepEqual(Object.keys(cols).sort(), [
      "attachedAt",
      "detachedAt",
      "id",
      "minutesBilled",
      "quotaId",
      "sessionId",
      "totalRoyaltyLzt",
      "totalSponsorHostLzt",
      "totalSponsorPlayerLzt",
    ]);
  });

  it("requires quotaId, sessionId and billing totals defaults", () => {
    const cols = getTableColumns(quotaSessionsTable);
    assert.equal(cols.quotaId.notNull, true);
    assert.equal(cols.sessionId.notNull, true);
    assert.equal(cols.attachedAt.notNull, true);
    assert.equal(cols.detachedAt.notNull, false);
    assert.equal(cols.totalRoyaltyLzt.notNull, true);
    assert.equal(cols.totalSponsorHostLzt.notNull, true);
    assert.equal(cols.totalSponsorPlayerLzt.notNull, true);
    assert.equal(cols.minutesBilled.notNull, true);
  });
});
