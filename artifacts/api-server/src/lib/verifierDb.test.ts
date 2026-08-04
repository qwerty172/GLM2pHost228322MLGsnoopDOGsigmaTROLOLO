import { describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";

describe("verifierDb", () => {
  it("exposes verifier DB adapter", async () => {
    const { verifierDb } = await import("./verifierDb");
    expect(verifierDb).toBeTruthy();
    expect(typeof verifierDb.insertLinkToken).toBe("function");
    expect(typeof verifierDb.consumeLinkToken).toBe("function");
  });
});
