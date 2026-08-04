import { describe, expect, it } from "vitest";
import { captureException, initSentry } from "./sentry";

describe("sentry", () => {
  it("no-ops when SENTRY_DSN unset", async () => {
    const prev = process.env.SENTRY_DSN;
    delete process.env.SENTRY_DSN;
    await expect(initSentry()).resolves.toBeUndefined();
    await expect(captureException(new Error("test"))).resolves.toBeUndefined();
    if (prev) process.env.SENTRY_DSN = prev;
  });
});
