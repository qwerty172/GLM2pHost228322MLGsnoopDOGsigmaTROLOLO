import { describe, expect, it } from "vitest";
import { captureException, initSentry } from "./sentry";

describe("sentry", () => {
  it("no-ops when Sentry is not configured", async () => {
    delete process.env.SENTRY_DSN;
    await expect(initSentry()).resolves.toBeUndefined();
    await expect(captureException(new Error("test"))).resolves.toBeUndefined();
  });
});
