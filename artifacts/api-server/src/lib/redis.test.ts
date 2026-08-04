import { describe, expect, it } from "vitest";
import { isRedisAvailable } from "./redis";

describe("redis", () => {
  it("isRedisAvailable defaults false before init", () => {
    expect(isRedisAvailable()).toBe(false);
  });
});
