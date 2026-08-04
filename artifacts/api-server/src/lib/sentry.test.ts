import { describe, expect, it } from "vitest";
import { captureException, initSentry } from "./sentry";

describe("sentry", () => {
  it("no-ops when SENTRY_DSN unset", async () => {
    delete process.env.SENTRY_DSN;
    await initSentry();
    await captureException(new Error("test"));
    expect(process.env.SENTRY_DSN).toBeUndefined();
  });
});
