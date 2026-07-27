/**
 * Integration: ledger invariant holds on a fresh test database.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { checkLedgerInvariant } from "../lib/ledgerInvariant";
import {
  setupIntegrationHarness,
  teardownIntegrationHarness,
  type IntegrationCtx,
} from "./helpers/integrationHarness";

const dbUrl = process.env.DATABASE_URL_TEST;

describe("ledger invariant", { skip: !dbUrl }, () => {
  let ctx: IntegrationCtx;

  before(async () => {
    ctx = await setupIntegrationHarness(dbUrl!);
  });

  after(async () => {
    await teardownIntegrationHarness(ctx);
  });

  it("empty database satisfies ledger invariant", async () => {
    const result = await checkLedgerInvariant(ctx.db);
    assert.equal(result.ok, true, JSON.stringify(result));
  });
});
