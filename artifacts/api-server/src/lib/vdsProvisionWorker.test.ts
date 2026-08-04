import { describe, expect, it, afterEach } from "vitest";
import { startVdsProvisionWorker, stopVdsProvisionWorker } from "./vdsProvisionWorker";

describe("vdsProvisionWorker", () => {
  afterEach(() => {
    stopVdsProvisionWorker();
  });

  it("exports start/stop", () => {
    expect(typeof startVdsProvisionWorker).toBe("function");
    expect(typeof stopVdsProvisionWorker).toBe("function");
  });

  it("start/stop without throwing", () => {
    expect(() => startVdsProvisionWorker()).not.toThrow();
    expect(() => stopVdsProvisionWorker()).not.toThrow();
  });
});
