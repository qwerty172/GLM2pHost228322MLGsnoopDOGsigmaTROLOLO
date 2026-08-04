import { describe, expect, it } from "vitest";
import { startHostHealthWorker, stopHostHealthWorker } from "./hostHealthWorker";

describe("hostHealthWorker", () => {
  it("start/stop without throwing", () => {
    startHostHealthWorker();
    stopHostHealthWorker();
    expect(true).toBe(true);
  });
});
