import { describe, expect, it } from "vitest";
import { listLibrary, addToLibrary, updateEntry, removeFromLibrary } from "./hostLibrary";

describe("hostLibrary", () => {
  it("exports library CRUD helpers", () => {
    expect(typeof listLibrary).toBe("function");
    expect(typeof addToLibrary).toBe("function");
    expect(typeof updateEntry).toBe("function");
    expect(typeof removeFromLibrary).toBe("function");
  });
});
