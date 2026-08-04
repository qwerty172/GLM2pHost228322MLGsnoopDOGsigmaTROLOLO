import { describe, expect, it } from "vitest";
import { isRedisAvailable } from "./redis";

describe("redis", () => {
  it("isRedisAvailable is false before init", () => {
    expect(isRedisAvailable()).toBe(false);
  });
});
