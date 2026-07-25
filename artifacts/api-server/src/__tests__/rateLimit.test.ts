import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Request } from "express";
import { recordFailedAttempt, clearFailedAttempts } from "../lib/rateLimit.js";

function fakeReq(ip = "203.0.113.1"): Request {
  return { ip } as Request;
}

describe("failedAttemptLimiter", () => {
  it("blocks after 10 consecutive failures with Retry-After semantics", async () => {
    process.env.RATE_LIMIT_STORAGE = "memory";
    const req = fakeReq();
    const scope = "test:token";

    for (let i = 0; i < 9; i++) {
      const r = await recordFailedAttempt(scope, req);
      assert.equal(r.blocked, false);
    }

    const tenth = await recordFailedAttempt(scope, req);
    assert.equal(tenth.blocked, true);
    assert.ok(tenth.retryAfterSec >= 1);

    await clearFailedAttempts(scope, req);
    const afterClear = await recordFailedAttempt(scope, req);
    assert.equal(afterClear.blocked, false);
  });
});
