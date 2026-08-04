import { describe, expect, it } from "vitest";
import { startHostHealthWorker } from "./hostHealthWorker";

describe("hostHealthWorker", () => {
  it("exports startHostHealthWorker", () => {
    expect(typeof startHostHealthWorker).toBe("function");
  });
});
