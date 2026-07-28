import { describe, it, expect } from "vitest";
import { evaluateObjectAccess, ObjectPermission } from "./objectAcl";

describe("evaluateObjectAccess", () => {
  it("legacy objects without ACL metadata allow public READ", () => {
    expect(
      evaluateObjectAccess({
        aclPolicy: null,
        requestedPermission: ObjectPermission.READ,
      }),
    ).toBe(true);
  });

  it("legacy objects without ACL metadata deny WRITE", () => {
    expect(
      evaluateObjectAccess({
        aclPolicy: null,
        requestedPermission: ObjectPermission.WRITE,
      }),
    ).toBe(false);
  });

  it("private object denies READ for non-owner", () => {
    expect(
      evaluateObjectAccess({
        aclPolicy: { owner: "host:1", visibility: "private" },
        requestedPermission: ObjectPermission.READ,
      }),
    ).toBe(false);
  });

  it("public object allows READ for anyone", () => {
    expect(
      evaluateObjectAccess({
        aclPolicy: { owner: "host:1", visibility: "public" },
        requestedPermission: ObjectPermission.READ,
      }),
    ).toBe(true);
  });

  it("owner can access private object", () => {
    expect(
      evaluateObjectAccess({
        aclPolicy: { owner: "host:1", visibility: "private" },
        userId: "host:1",
        requestedPermission: ObjectPermission.WRITE,
      }),
    ).toBe(true);
  });
});
