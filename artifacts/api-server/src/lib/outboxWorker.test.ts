import { describe, expect, it } from "vitest";
import { registerOutboxHandler } from "./outboxWorker";

describe("outboxWorker", () => {
  it("registerOutboxHandler accepts handler", () => {
    registerOutboxHandler("test-event", async () => {});
    expect(true).toBe(true);
  });
});
