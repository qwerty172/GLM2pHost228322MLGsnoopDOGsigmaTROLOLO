import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getTableColumns, getTableName } from "drizzle-orm";
import { quotasTable } from "../src/schema/quotas.ts";

describe("quotasTable", () => {
  it("maps to quotas", () => {
    assert.equal(getTableName(quotasTable), "quotas");
  });

  it("exposes quota columns", () => {
    const cols = getTableColumns(quotasTable);
    assert.deepEqual(Object.keys(cols).sort(), [
      "accessCode",
      "budgetLzt",
      "createdAt",
      "description",
      "devKeyId",
      "endAt",
      "escrowRemainingLzt",
      "gameId",
      "id",
      "kind",
      "maxSessionMinutes",
      "minCpuCores",
      "minDownloadMbps",
      "minGpuVram",
      "minRamGb",
      "minSessionMinutes",
      "minUploadMbps",
      "ownerId",
      "ownerType",
      "recCpuCores",
      "recDownloadMbps",
      "recGpuVram",
      "recRamGb",
      "recUploadMbps",
      "requiredTier",
      "royaltyBasis",
      "royaltySource",
      "royaltyValue",
      "sponsorHostPerMinuteLzt",
      "sponsorPlayerPerMinuteLzt",
      "startAt",
      "status",
      "title",
      "updatedAt",
      "visibility",
    ]);
  });

  it("requires owner, kind, title and status defaults", () => {
    const cols = getTableColumns(quotasTable);
    assert.equal(cols.ownerType.notNull, true);
    assert.equal(cols.ownerId.notNull, true);
    assert.equal(cols.kind.notNull, true);
    assert.equal(cols.status.notNull, true);
    assert.equal(cols.title.notNull, true);
    assert.equal(cols.description.notNull, true);
    assert.equal(cols.visibility.notNull, true);
    assert.equal(cols.requiredTier.notNull, true);
    assert.equal(cols.startAt.notNull, true);
    assert.equal(cols.createdAt.notNull, true);
    assert.equal(cols.updatedAt.notNull, true);
    assert.equal(cols.gameId.notNull, false);
    assert.equal(cols.accessCode.notNull, false);
    assert.equal(cols.devKeyId.notNull, false);
    assert.equal(cols.minSessionMinutes.notNull, false);
    assert.equal(cols.maxSessionMinutes.notNull, false);
    assert.equal(cols.minGpuVram.notNull, false);
    assert.equal(cols.minCpuCores.notNull, false);
    assert.equal(cols.minRamGb.notNull, false);
    assert.equal(cols.minDownloadMbps.notNull, false);
    assert.equal(cols.minUploadMbps.notNull, false);
    assert.equal(cols.recGpuVram.notNull, false);
    assert.equal(cols.recCpuCores.notNull, false);
    assert.equal(cols.recRamGb.notNull, false);
    assert.equal(cols.recDownloadMbps.notNull, false);
    assert.equal(cols.recUploadMbps.notNull, false);
    assert.equal(cols.endAt.notNull, false);
    assert.equal(cols.budgetLzt.notNull, false);
    assert.equal(cols.escrowRemainingLzt.notNull, false);
    assert.equal(cols.sponsorHostPerMinuteLzt.notNull, false);
    assert.equal(cols.sponsorPlayerPerMinuteLzt.notNull, false);
    assert.equal(cols.royaltyBasis.notNull, false);
    assert.equal(cols.royaltyValue.notNull, false);
    assert.equal(cols.royaltySource.notNull, false);
  });
});
