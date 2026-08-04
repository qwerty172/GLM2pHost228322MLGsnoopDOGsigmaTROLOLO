import { describe, expect, it } from "vitest";
import { startVdsProvisionWorker, stopVdsProvisionWorker } from "./vdsProvisionWorker";

describe("vdsProvisionWorker", () => {
  it("exports lifecycle functions", () => {
    expect(typeof startVdsProvisionWorker).toBe("function");
    expect(typeof stopVdsProvisionWorker).toBe("function");
  });
});
