import { describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";

describe("outboxWorker", () => {
  it("exports outbox helpers", async () => {
    const mod = await import("./outboxWorker");
    expect(typeof mod.registerOutboxHandler).toBe("function");
    expect(typeof mod.startOutboxWorker).toBe("function");
    expect(typeof mod.insertOutboxEvent).toBe("function");
    expect(typeof mod.cleanupOutbox).toBe("function");
  });
});
