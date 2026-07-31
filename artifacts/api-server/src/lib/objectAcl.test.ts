import { describe, expect, it } from "vitest";
import { isLegacyPublicCoverPath } from "./objectAcl";

describe("isLegacyPublicCoverPath", () => {
  it("allows legacy cover uploads without ACL metadata", () => {
    expect(isLegacyPublicCoverPath("uploads/550e8400-e29b-41d4-a716-446655440000")).toBe(
      true,
    );
    expect(isLegacyPublicCoverPath("uploads/nested/cover.webp")).toBe(true);
  });

  it("denies non-cover paths that lack ACL metadata", () => {
    expect(isLegacyPublicCoverPath("saves/player-id/game-id/save.zip")).toBe(false);
    expect(isLegacyPublicCoverPath("saves/player-id/game-id/uuid.zip")).toBe(false);
    expect(isLegacyPublicCoverPath("clips/abc.webm")).toBe(false);
    expect(isLegacyPublicCoverPath("")).toBe(false);
  });
});
