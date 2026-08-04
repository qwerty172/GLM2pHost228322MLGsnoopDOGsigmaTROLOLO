import { describe, expect, it } from "vitest";
import { startHostHealthWorker, stopHostHealthWorker } from "./hostHealthWorker";

describe("hostHealthWorker", () => {
  it("exports lifecycle functions", () => {
    expect(typeof startHostHealthWorker).toBe("function");
    expect(typeof stopHostHealthWorker).toBe("function");
  });
});
