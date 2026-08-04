import { describe, expect, it } from "vitest";
import { listLibrary } from "./hostLibrary";

describe("hostLibrary", () => {
  it("exports listLibrary", () => {
    expect(typeof listLibrary).toBe("function");
  });
});
