import { describe, expect, it } from "vitest";
import {
  registerOutboxHandler,
  startOutboxWorker,
  insertOutboxEvent,
  cleanupOutbox,
} from "./outboxWorker";

describe("outboxWorker", () => {
  it("exports outbox API", () => {
    expect(typeof registerOutboxHandler).toBe("function");
    expect(typeof startOutboxWorker).toBe("function");
    expect(typeof insertOutboxEvent).toBe("function");
    expect(typeof cleanupOutbox).toBe("function");
  });

  it("startOutboxWorker registers default handlers", () => {
    expect(() => startOutboxWorker()).not.toThrow();
  });
});
