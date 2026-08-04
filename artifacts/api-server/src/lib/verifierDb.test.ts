import { describe, expect, it } from "vitest";
import { verifierDb } from "./verifierDb";

describe("verifierDb", () => {
  it("exports VerifierDb adapter", () => {
    expect(verifierDb).toBeTruthy();
    expect(typeof verifierDb.insertLinkToken).toBe("function");
    expect(typeof verifierDb.consumeLinkToken).toBe("function");
  });
});
