import { describe, expect, it } from "vitest";
import { startOutboxWorker } from "./outboxWorker";

describe("outboxWorker", () => {
  it("exports startOutboxWorker", () => {
    expect(typeof startOutboxWorker).toBe("function");
  });
});
