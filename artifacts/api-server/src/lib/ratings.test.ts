import { describe, expect, it } from "vitest";
import { submitSessionRating } from "./ratings";

describe("ratings", () => {
  it("rejects invalid scores before DB", async () => {
    const result = await submitSessionRating({
      sessionId: "s1",
      playerId: "p1",
      hostId: "h1",
      score: 0,
    });
    expect(result).toEqual({ ok: false, error: "score must be 1–5" });
    const result2 = await submitSessionRating({
      sessionId: "s1",
      playerId: "p1",
      hostId: "h1",
      score: 6,
    });
    expect(result2.ok).toBe(false);
  });
});
