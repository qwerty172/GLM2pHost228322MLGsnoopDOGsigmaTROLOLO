import { describe, it, expect, vi, beforeEach } from "vitest";

const mockLimit = vi.fn();

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: mockLimit,
        })),
      })),
    })),
  },
  gamesTable: { id: "id", coverImageUrl: "coverImageUrl" },
  gameSubmissionsTable: { id: "id", coverImageUrl: "coverImageUrl" },
}));

import { isCatalogCoverObjectPath } from "./catalogCoverPaths";

describe("isCatalogCoverObjectPath", () => {
  beforeEach(() => {
    mockLimit.mockReset();
  });

  it("returns false for empty or invalid paths", async () => {
    await expect(isCatalogCoverObjectPath("")).resolves.toBe(false);
    await expect(isCatalogCoverObjectPath("/rf3-cover.svg")).resolves.toBe(false);
  });

  it("returns true when a game cover matches the object path", async () => {
    mockLimit
      .mockResolvedValueOnce([
        { id: "game-1", coverImageUrl: "/objects/uploads/cover.png" },
      ])
      .mockResolvedValueOnce([]);

    await expect(isCatalogCoverObjectPath("/objects/uploads/cover.png")).resolves.toBe(true);
    expect(mockLimit).toHaveBeenCalledTimes(1);
  });

  it("returns true when a submission cover matches after no game match", async () => {
    mockLimit
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "sub-1",
          coverImageUrl: "/api/storage/objects/uploads/sub-cover.png",
        },
      ]);

    await expect(isCatalogCoverObjectPath("/objects/uploads/sub-cover.png")).resolves.toBe(
      true,
    );
    expect(mockLimit).toHaveBeenCalledTimes(2);
  });

  it("returns false when LIKE hits a row but normalized URL does not match", async () => {
    mockLimit
      .mockResolvedValueOnce([
        { id: "game-1", coverImageUrl: "/objects/uploads/other.png" },
      ])
      .mockResolvedValueOnce([]);

    await expect(isCatalogCoverObjectPath("/objects/uploads/wanted.png")).resolves.toBe(
      false,
    );
  });

  it("returns false when no catalog row references the object", async () => {
    mockLimit.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await expect(isCatalogCoverObjectPath("/objects/uploads/missing.png")).resolves.toBe(
      false,
    );
  });
});
