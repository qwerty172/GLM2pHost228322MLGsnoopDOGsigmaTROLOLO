import { describe, expect, it } from "vitest";
import { captureException, initSentry } from "./sentry";

describe("sentry", () => {
  it("no-ops when SENTRY_DSN unset", async () => {
    const prev = process.env.SENTRY_DSN;
    delete process.env.SENTRY_DSN;
    await initSentry();
    await captureException(new Error("test"));
    if (prev) process.env.SENTRY_DSN = prev;
    expect(true).toBe(true);
  });
});
