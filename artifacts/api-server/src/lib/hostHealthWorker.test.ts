import { describe, expect, it, afterEach } from "vitest";
import { startHostHealthWorker, stopHostHealthWorker } from "./hostHealthWorker";

describe("hostHealthWorker", () => {
  afterEach(() => {
    stopHostHealthWorker();
  });

  it("exports start/stop", () => {
    expect(typeof startHostHealthWorker).toBe("function");
    expect(typeof stopHostHealthWorker).toBe("function");
  });

  it("start/stop without throwing", () => {
    expect(() => startHostHealthWorker()).not.toThrow();
    expect(() => stopHostHealthWorker()).not.toThrow();
  });
});
