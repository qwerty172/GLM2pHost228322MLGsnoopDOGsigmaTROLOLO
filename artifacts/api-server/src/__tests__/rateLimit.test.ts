import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response, NextFunction } from "express";
import {
  recordFailedAttempt,
  clearFailedAttempts,
  guardAndTrackFailures,
} from "../lib/rateLimit.js";

function fakeReq(ip = "203.0.113.1"): Request {
  return { ip } as Request;
}

function fakeRes(): Response & {
  statusCode: number;
  headers: Record<string, string>;
} {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
      return this;
    },
    json(_body: unknown) {
      return this;
    },
  };
  return res as Response & { statusCode: number; headers: Record<string, string> };
}

async function runMiddleware(
  middleware: ReturnType<typeof guardAndTrackFailures>,
  req: Request,
  res: Response,
): Promise<boolean> {
  let nextCalled = false;
  await middleware(req, res, (() => {
    nextCalled = true;
  }) as NextFunction);
  return nextCalled;
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

describe("guardAndTrackFailures", () => {
  it("locks IP after 10 not-found responses without incrementing on success", async () => {
    process.env.RATE_LIMIT_STORAGE = "memory";
    const req = fakeReq("198.51.100.42");
    const guard = guardAndTrackFailures("test:wallet:read");

    for (let i = 0; i < 10; i++) {
      const res = fakeRes();
      const nextCalled = await runMiddleware(guard, req, res);
      assert.equal(nextCalled, true, `attempt ${i + 1} should pass guard`);
      res.status(404).json({ error: "User not found" });
      await new Promise((r) => setTimeout(r, 0));
    }

    const blockedRes = fakeRes();
    const blockedNext = await runMiddleware(guard, req, blockedRes);
    assert.equal(blockedNext, false);
    assert.equal(blockedRes.statusCode, 429);
    assert.ok(blockedRes.headers["Retry-After"]);

    const okRes = fakeRes();
    const okNext = await runMiddleware(guard, fakeReq("198.51.100.99"), okRes);
    assert.equal(okNext, true);
    okRes.status(200).json({ ok: true });
    await new Promise((r) => setTimeout(r, 0));

    const afterSuccessRes = fakeRes();
    const afterSuccessNext = await runMiddleware(
      guard,
      fakeReq("198.51.100.99"),
      afterSuccessRes,
    );
    assert.equal(afterSuccessNext, true);
  });
});
