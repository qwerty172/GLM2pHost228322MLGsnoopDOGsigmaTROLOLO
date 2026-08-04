import { describe, expect, it } from "vitest";
import { startVdsProvisionWorker } from "./vdsProvisionWorker";

describe("vdsProvisionWorker", () => {
  it("exports startVdsProvisionWorker", () => {
    expect(typeof startVdsProvisionWorker).toBe("function");
  });
});
