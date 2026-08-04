import { describe, expect, it } from "vitest";
import { applyLaunchFee } from "./launchFee";

describe("launchFee", () => {
  it("applyLaunchFee is exported", () => {
    expect(typeof applyLaunchFee).toBe("function");
  });
});
