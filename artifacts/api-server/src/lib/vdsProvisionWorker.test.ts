import { describe, expect, it } from "vitest";
import { startVdsProvisionWorker, stopVdsProvisionWorker } from "./vdsProvisionWorker";

describe("vdsProvisionWorker", () => {
  it("exports start/stop", () => {
    expect(typeof startVdsProvisionWorker).toBe("function");
    expect(typeof stopVdsProvisionWorker).toBe("function");
  });
});
