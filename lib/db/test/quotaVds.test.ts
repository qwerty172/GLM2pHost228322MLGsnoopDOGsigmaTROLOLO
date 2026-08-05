import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getTableColumns, getTableName } from "drizzle-orm";
import { quotaVdsTable } from "../src/schema/quotaVds.ts";

describe("quotaVdsTable", () => {
  it("maps to quota_vds", () => {
    assert.equal(getTableName(quotaVdsTable), "quota_vds");
  });

  it("exposes quota vds columns", () => {
    const cols = getTableColumns(quotaVdsTable);
    assert.deepEqual(Object.keys(cols).sort(), [
      "createdAt",
      "hostId",
      "id",
      "lastHealthAt",
      "provider",
      "provisionLog",
      "quotaId",
      "sshHost",
      "sshKeyEncrypted",
      "sshPort",
      "sshUser",
      "status",
      "updatedAt",
    ]);
  });

  it("requires quotaId, ssh credentials and provisioning defaults", () => {
    const cols = getTableColumns(quotaVdsTable);
    assert.equal(cols.quotaId.notNull, true);
    assert.equal(cols.provider.notNull, true);
    assert.equal(cols.sshHost.notNull, true);
    assert.equal(cols.sshPort.notNull, true);
    assert.equal(cols.sshUser.notNull, true);
    assert.equal(cols.sshKeyEncrypted.notNull, true);
    assert.equal(cols.status.notNull, true);
    assert.equal(cols.provisionLog.notNull, true);
    assert.equal(cols.createdAt.notNull, true);
    assert.equal(cols.updatedAt.notNull, true);
    assert.equal(cols.lastHealthAt.notNull, false);
    assert.equal(cols.hostId.notNull, false);
  });
});
