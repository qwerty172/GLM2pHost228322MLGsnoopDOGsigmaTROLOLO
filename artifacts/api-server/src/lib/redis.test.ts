import { describe, expect, it } from "vitest";
import { isRedisAvailable } from "./redis";

describe("redis", () => {
  it("isRedisAvailable is false without init", () => {
    expect(isRedisAvailable()).toBe(false);
  });
});
