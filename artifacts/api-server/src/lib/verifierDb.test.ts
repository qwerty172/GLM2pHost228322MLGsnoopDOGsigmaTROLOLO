import { describe, expect, it } from "vitest";
import { verifierDb } from "./verifierDb";

describe("verifierDb", () => {
  it("implements VerifierDb interface methods", () => {
    expect(typeof verifierDb.insertLinkToken).toBe("function");
    expect(typeof verifierDb.consumeLinkToken).toBe("function");
    expect(typeof verifierDb.insertChallenge).toBe("function");
  });
});
