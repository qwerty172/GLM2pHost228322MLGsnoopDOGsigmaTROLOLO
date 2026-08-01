import { describe, expect, it } from "vitest";
import {
  decideObjectReadAccess,
  isLegacyPublicObjectPath,
} from "./objectAcl";

describe("isLegacyPublicObjectPath", () => {
  it("allows uploads/* paths", () => {
    expect(isLegacyPublicObjectPath("/objects/uploads/abc-123")).toBe(true);
    expect(isLegacyPublicObjectPath("objects/uploads/abc-123")).toBe(true);
  });

  it("rejects non-upload paths", () => {
    expect(isLegacyPublicObjectPath("/objects/saves/player/game/save.zip")).toBe(
      false,
    );
    expect(isLegacyPublicObjectPath("/objects/clips/foo.webm")).toBe(false);
  });
});

describe("decideObjectReadAccess", () => {
  it("allows legacy uploads without ACL", () => {
    expect(
      decideObjectReadAccess({
        objectPath: "/objects/uploads/cover.png",
        policy: null,
        canAccess: false,
      }),
    ).toEqual({ allowed: true });
  });

  it("denies saves without ACL and without auth", () => {
    expect(
      decideObjectReadAccess({
        objectPath: "/objects/saves/p1/g1/save.zip",
        policy: null,
        canAccess: false,
      }),
    ).toEqual({ allowed: false, status: 401 });
  });

  it("returns 403 when ACL denies authenticated user", () => {
    expect(
      decideObjectReadAccess({
        objectPath: "/objects/saves/p1/g1/save.zip",
        policy: { owner: "player:p1", visibility: "private" },
        canAccess: false,
        userId: "player:p2",
      }),
    ).toEqual({ allowed: false, status: 403 });
  });

  it("returns 401 when ACL denies anonymous user", () => {
    expect(
      decideObjectReadAccess({
        objectPath: "/objects/saves/p1/g1/save.zip",
        policy: { owner: "player:p1", visibility: "private" },
        canAccess: false,
      }),
    ).toEqual({ allowed: false, status: 401 });
  });

  it("allows owner when ACL grants access", () => {
    expect(
      decideObjectReadAccess({
        objectPath: "/objects/saves/p1/g1/save.zip",
        policy: { owner: "player:p1", visibility: "private" },
        canAccess: true,
        userId: "player:p1",
      }),
    ).toEqual({ allowed: true });
  });
});
