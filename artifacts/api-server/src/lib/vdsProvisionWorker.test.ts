import { describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";

describe("vdsProvisionWorker", () => {
  it("exports worker lifecycle", async () => {
    const mod = await import("./vdsProvisionWorker");
    expect(typeof mod.startVdsProvisionWorker).toBe("function");
    expect(typeof mod.stopVdsProvisionWorker).toBe("function");
  });

  it("writes hostToken into provision log for operator retrieval", async () => {
    const { hostTokenProvisionLogLine } = await import("./vdsProvisionWorker");
    expect(hostTokenProvisionLogLine("vds-abc123")).toBe("[OK] hostToken: vds-abc123");
  });
});
