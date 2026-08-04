import { describe, expect, it, afterEach } from "vitest";
import { initSentry, captureException } from "./sentry";

describe("sentry", () => {
  afterEach(() => {
    delete process.env.SENTRY_DSN;
  });

  it("initSentry is no-op without DSN", async () => {
    delete process.env.SENTRY_DSN;
    await expect(initSentry()).resolves.toBeUndefined();
  });

  it("captureException does not throw without DSN", async () => {
    delete process.env.SENTRY_DSN;
    await expect(captureException(new Error("test"))).resolves.toBeUndefined();
  });
});
