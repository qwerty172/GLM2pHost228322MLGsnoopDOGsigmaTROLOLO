import { describe, expect, it } from "vitest";
import { submitSessionRating } from "./ratings";

describe("submitSessionRating validation", () => {
  it("rejects invalid scores before DB", async () => {
    const r = await submitSessionRating({
      sessionId: "s1",
      playerId: "p1",
      hostId: "h1",
      score: 0,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("1–5");
  });
});
