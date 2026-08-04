import { describe, expect, it } from "vitest";
import { isRedisAvailable } from "./redis";

describe("redis", () => {
  it("reports unavailable before init", () => {
    expect(isRedisAvailable()).toBe(false);
  });
});
