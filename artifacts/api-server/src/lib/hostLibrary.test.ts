import { describe, expect, it } from "vitest";
import { addToLibrary, listLibrary } from "./hostLibrary";

describe("hostLibrary", () => {
  it("exports library helpers", () => {
    expect(typeof listLibrary).toBe("function");
    expect(typeof addToLibrary).toBe("function");
  });
});
