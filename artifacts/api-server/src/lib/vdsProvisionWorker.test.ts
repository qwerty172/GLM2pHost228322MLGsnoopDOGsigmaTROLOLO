import { describe, expect, it } from "vitest";
import { startVdsProvisionWorker, stopVdsProvisionWorker } from "./vdsProvisionWorker";

describe("vdsProvisionWorker", () => {
  it("start/stop without throwing", () => {
    startVdsProvisionWorker();
    stopVdsProvisionWorker();
    expect(true).toBe(true);
  });
});
