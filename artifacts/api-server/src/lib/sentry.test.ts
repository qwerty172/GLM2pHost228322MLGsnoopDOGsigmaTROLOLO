import { describe, expect, it } from "vitest";
import { captureException, initSentry } from "./sentry";

describe("sentry", () => {
  it("initSentry resolves without SENTRY_DSN", async () => {
    const prev = process.env.SENTRY_DSN;
    delete process.env.SENTRY_DSN;
    await expect(initSentry()).resolves.toBeUndefined();
    await expect(captureException(new Error("test"))).resolves.toBeUndefined();
    if (prev !== undefined) process.env.SENTRY_DSN = prev;
  });
});
