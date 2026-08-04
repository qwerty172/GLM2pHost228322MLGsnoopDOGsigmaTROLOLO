import { describe, expect, it } from "vitest";
import { registerOutboxHandler, startOutboxWorker, insertOutboxEvent } from "./outboxWorker";

describe("outboxWorker", () => {
  it("exports outbox API", () => {
    expect(typeof registerOutboxHandler).toBe("function");
    expect(typeof startOutboxWorker).toBe("function");
    expect(typeof insertOutboxEvent).toBe("function");
  });
});
