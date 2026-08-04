import { describe, expect, it } from "vitest";
import { submitSessionRating } from "./ratings";

describe("ratings", () => {
  it("rejects invalid score before hitting DB", async () => {
    await expect(
      submitSessionRating({
        sessionId: "s1",
        playerId: "p1",
        hostId: "h1",
        score: 0,
      }),
    ).resolves.toEqual({ ok: false, error: "score must be 1–5" });

    await expect(
      submitSessionRating({
        sessionId: "s1",
        playerId: "p1",
        hostId: "h1",
        score: 6,
      }),
    ).resolves.toEqual({ ok: false, error: "score must be 1–5" });
  });
});
