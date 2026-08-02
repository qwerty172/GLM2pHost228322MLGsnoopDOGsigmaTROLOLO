import { describe, expect, it } from "vitest";
import {
  ObjectPermission,
  evaluateAclAccess,
  type ObjectAclPolicy,
} from "./objectAcl";
import { parseObjectEntityPathFromUrl } from "./objectEntityPaths";

const publicCover: ObjectAclPolicy = {
  owner: "host:abc",
  visibility: "public",
};

const privateSave: ObjectAclPolicy = {
  owner: "player:player-1",
  visibility: "private",
};

describe("parseObjectEntityPathFromUrl", () => {
  it("parses /api/storage/objects/ prefix", () => {
    expect(
      parseObjectEntityPathFromUrl(
        "/api/storage/objects/uploads/cover.webp",
      ),
    ).toBe("/objects/uploads/cover.webp");
  });

  it("accepts canonical /objects/ paths", () => {
    expect(parseObjectEntityPathFromUrl("/objects/saves/p/g/save.zip")).toBe(
      "/objects/saves/p/g/save.zip",
    );
  });

  it("returns null for external URLs and empty paths", () => {
    expect(parseObjectEntityPathFromUrl("https://cdn.example/cover.jpg")).toBeNull();
    expect(parseObjectEntityPathFromUrl("/games/cover.jpg")).toBeNull();
    expect(parseObjectEntityPathFromUrl("")).toBeNull();
  });
});

describe("evaluateAclAccess", () => {
  it("denies access when ACL metadata is missing (legacy public read closed)", () => {
    expect(evaluateAclAccess(null, undefined, ObjectPermission.READ)).toBe(false);
    expect(evaluateAclAccess(null, "host:abc", ObjectPermission.READ)).toBe(false);
  });

  it("allows anonymous READ on public objects", () => {
    expect(
      evaluateAclAccess(publicCover, undefined, ObjectPermission.READ),
    ).toBe(true);
  });

  it("denies anonymous WRITE even on public objects", () => {
    expect(
      evaluateAclAccess(publicCover, undefined, ObjectPermission.WRITE),
    ).toBe(false);
  });

  it("allows owner READ/WRITE on private objects", () => {
    expect(
      evaluateAclAccess(privateSave, "player:player-1", ObjectPermission.READ),
    ).toBe(true);
    expect(
      evaluateAclAccess(privateSave, "player:player-1", ObjectPermission.WRITE),
    ).toBe(true);
  });

  it("denies non-owner access to private objects", () => {
    expect(
      evaluateAclAccess(privateSave, undefined, ObjectPermission.READ),
    ).toBe(false);
    expect(
      evaluateAclAccess(privateSave, "player:other", ObjectPermission.READ),
    ).toBe(false);
    expect(
      evaluateAclAccess(privateSave, "host:abc", ObjectPermission.READ),
    ).toBe(false);
  });

  it("allows host owner READ on their private upload before public ACL", () => {
    const hostUpload: ObjectAclPolicy = {
      owner: "host:host-42",
      visibility: "private",
    };
    expect(
      evaluateAclAccess(hostUpload, "host:host-42", ObjectPermission.READ),
    ).toBe(true);
    expect(
      evaluateAclAccess(hostUpload, undefined, ObjectPermission.READ),
    ).toBe(false);
  });
});
