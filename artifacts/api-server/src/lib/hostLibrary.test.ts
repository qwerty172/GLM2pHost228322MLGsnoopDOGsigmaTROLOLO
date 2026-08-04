import { describe, expect, it } from "vitest";
import { listLibrary } from "./hostLibrary";

describe("hostLibrary", () => {
  it("listLibrary is exported", () => {
    expect(typeof listLibrary).toBe("function");
  });
});
