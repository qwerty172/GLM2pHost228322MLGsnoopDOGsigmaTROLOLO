import { describe, it, expect, beforeEach } from "vitest";
import type { Request } from "express";
import { recordFailedAttempt, clearFailedAttempts } from "../lib/rateLimit";

function fakeReq(ip = "203.0.113.1"): Request {
  return { ip } as Request;
}

describe("failedAttemptLimiter", () => {
  beforeEach(() => {
    process.env.RATE_LIMIT_STORAGE = "memory";
  });

  it("blocks after 10 consecutive failures with Retry-After semantics", async () => {
    const req = fakeReq();
    const scope = "test:token";

    for (let i = 0; i < 9; i++) {
      const r = await recordFailedAttempt(scope, req);
      expect(r.blocked).toBe(false);
    }

    const tenth = await recordFailedAttempt(scope, req);
    expect(tenth.blocked).toBe(true);
    expect(tenth.retryAfterSec).toBeGreaterThanOrEqual(1);

    await clearFailedAttempts(scope, req);
    const afterClear = await recordFailedAttempt(scope, req);
    expect(afterClear.blocked).toBe(false);
  });
});
