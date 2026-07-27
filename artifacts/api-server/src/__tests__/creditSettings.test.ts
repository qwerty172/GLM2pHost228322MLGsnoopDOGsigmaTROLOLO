import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  creditEnabledFromLimit,
  creditLimitFromEnabled,
  DEFAULT_CREDIT_LIMIT_LZT,
  GUEST_CREDIT_LIMIT_LZT,
} from "../lib/creditSettings.js";

describe("creditSettings", () => {
  it("creditEnabledFromLimit is true when limit > 0", () => {
    assert.equal(creditEnabledFromLimit(DEFAULT_CREDIT_LIMIT_LZT), true);
    assert.equal(creditEnabledFromLimit(1), true);
    assert.equal(creditEnabledFromLimit(0), false);
  });

  it("creditLimitFromEnabled restores guest vs full defaults", () => {
    assert.equal(creditLimitFromEnabled(true, true), GUEST_CREDIT_LIMIT_LZT);
    assert.equal(creditLimitFromEnabled(true, false), DEFAULT_CREDIT_LIMIT_LZT);
    assert.equal(creditLimitFromEnabled(false, true), 0);
    assert.equal(creditLimitFromEnabled(false, false), 0);
  });
});
