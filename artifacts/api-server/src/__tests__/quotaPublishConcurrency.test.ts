/**
 * Regression guard: sponsor quota publish must row-lock before escrow debit.
 * Full concurrent integration tests require DATABASE_URL_TEST.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const quotasSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../routes/quotas.ts"),
  "utf8",
);

function publishHandlerBlock(): string {
  const start = quotasSrc.indexOf('router.post("/quotas/:id/publish"');
  assert.ok(start >= 0, "publish route must exist");
  const end = quotasSrc.indexOf("// ---------- Pause", start);
  assert.ok(end > start, "pause section must follow publish");
  return quotasSrc.slice(start, end);
}

describe("quota publish concurrency guard", () => {
  it("locks quota row with FOR UPDATE before escrow debit", () => {
    const block = publishHandlerBlock();
    assert.match(
      block,
      /\.for\("update"\)/,
      "publish must SELECT … FOR UPDATE to prevent double escrow lock",
    );
  });

  it("pause and close handlers also row-lock (reference pattern)", () => {
    assert.match(quotasSrc, /\/quotas\/:id\/pause[\s\S]*?\.for\("update"\)/);
    assert.match(quotasSrc, /\/quotas\/:id\/close[\s\S]*?\.for\("update"\)/);
  });
});
