import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getTableColumns, getTableName } from "drizzle-orm";
import {
  verifierChallengesTable,
  verifierLinkTokensTable,
  verifierLinksTable,
} from "../src/schema/verifierLinks.ts";

describe("verifierLinksTable", () => {
  it("maps to verifier_links", () => {
    assert.equal(getTableName(verifierLinksTable), "verifier_links");
  });

  it("exposes verifier link columns", () => {
    const cols = getTableColumns(verifierLinksTable);
    assert.deepEqual(Object.keys(cols).sort(), [
      "active",
      "id",
      "linkedAt",
      "provider",
      "providerUserId",
      "providerUsername",
      "userId",
      "userType",
    ]);
  });

  it("requires userId, userType, provider and providerUserId", () => {
    const cols = getTableColumns(verifierLinksTable);
    assert.equal(cols.userId.notNull, true);
    assert.equal(cols.userType.notNull, true);
    assert.equal(cols.provider.notNull, true);
    assert.equal(cols.providerUserId.notNull, true);
    assert.equal(cols.active.notNull, true);
    assert.equal(cols.linkedAt.notNull, true);
    assert.equal(cols.providerUsername.notNull, false);
  });
});

describe("verifierLinkTokensTable", () => {
  it("maps to verifier_link_tokens", () => {
    assert.equal(getTableName(verifierLinkTokensTable), "verifier_link_tokens");
  });

  it("exposes link token columns", () => {
    const cols = getTableColumns(verifierLinkTokensTable);
    assert.deepEqual(Object.keys(cols).sort(), [
      "consumedAt",
      "expiresAt",
      "id",
      "provider",
      "token",
      "userId",
      "userType",
    ]);
  });

  it("requires token, userId, userType, provider and expiresAt", () => {
    const cols = getTableColumns(verifierLinkTokensTable);
    assert.equal(cols.token.notNull, true);
    assert.equal(cols.userId.notNull, true);
    assert.equal(cols.userType.notNull, true);
    assert.equal(cols.provider.notNull, true);
    assert.equal(cols.expiresAt.notNull, true);
    assert.equal(cols.consumedAt.notNull, false);
  });
});

describe("verifierChallengesTable", () => {
  it("maps to verifier_challenges", () => {
    assert.equal(getTableName(verifierChallengesTable), "verifier_challenges");
  });

  it("exposes challenge columns", () => {
    const cols = getTableColumns(verifierChallengesTable);
    assert.deepEqual(Object.keys(cols).sort(), [
      "codes",
      "completedAt",
      "createdAt",
      "expiresAt",
      "id",
      "purpose",
      "userId",
      "userType",
      "verifiedProviders",
    ]);
  });

  it("requires id, userId, userType, codes and expiresAt", () => {
    const cols = getTableColumns(verifierChallengesTable);
    assert.equal(cols.id.notNull, true);
    assert.equal(cols.userId.notNull, true);
    assert.equal(cols.userType.notNull, true);
    assert.equal(cols.codes.notNull, true);
    assert.equal(cols.expiresAt.notNull, true);
    assert.equal(cols.purpose.notNull, true);
    assert.equal(cols.verifiedProviders.notNull, true);
    assert.equal(cols.createdAt.notNull, true);
    assert.equal(cols.completedAt.notNull, false);
  });
});
