import { describe, expect, it } from "vitest";
import { verifierDb } from "./verifierDb";

describe("verifierDb", () => {
  it("exports VerifierDb interface methods", () => {
    expect(typeof verifierDb.insertLinkToken).toBe("function");
    expect(typeof verifierDb.consumeLinkToken).toBe("function");
    expect(typeof verifierDb.getLinks).toBe("function");
    expect(typeof verifierDb.setTrustLevel).toBe("function");
  });
});
