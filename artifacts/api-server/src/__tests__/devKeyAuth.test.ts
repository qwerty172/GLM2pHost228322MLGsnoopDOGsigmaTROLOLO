import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import type { Request } from "express";
import { authorizeDevKeyCreate } from "../lib/devKeyAuth.js";

function fakeReq(headers: Record<string, string> = {}): Request {
  return { headers } as Request;
}

describe("authorizeDevKeyCreate", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
    delete process.env.DEV_KEYS_CREATE_SECRET;
    delete process.env.ADMIN_SECRET;
    delete process.env.ALLOW_OPEN_DEV_KEY_CREATE;
    process.env.NODE_ENV = "production";
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("rejects unauthenticated requests in production", async () => {
    const result = await authorizeDevKeyCreate(fakeReq());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 401);
    }
  });

  it("accepts matching X-Dev-Key-Secret", async () => {
    process.env.DEV_KEYS_CREATE_SECRET = "test-secret";
    const result = await authorizeDevKeyCreate(
      fakeReq({ "x-dev-key-secret": "test-secret" }),
    );
    assert.equal(result.ok, true);
  });
});
