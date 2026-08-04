import { describe, expect, it } from "vitest";
import { isRedisAvailable, redisHealthCheck } from "./redis";

describe("redis", () => {
  it("reports unavailable when not initialized", () => {
    expect(isRedisAvailable()).toBe(false);
  });

  it("health check fails when client not configured", async () => {
    await expect(redisHealthCheck()).resolves.toEqual({ ok: false, reason: "not configured" });
  });
});
