import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {
  isPathWithinRoot,
  resolveSafeExtractTarget,
} from "../dist/main/main/save-sync-paths.js";

describe("save-sync path safety", () => {
  const saveRoot = path.resolve("C:/Games/MyGame/saves");

  it("allows files under an allowed root", () => {
    const file = path.win32.join(saveRoot, "slot1", "save.dat");
    assert.equal(isPathWithinRoot(file, saveRoot), true);
    assert.equal(
      resolveSafeExtractTarget(file, [saveRoot]),
      path.win32.normalize(file),
    );
  });

  it("rejects absolute paths outside allowed roots", () => {
    const evil = "C:/Windows/System32/evil.dll";
    assert.equal(isPathWithinRoot(evil, saveRoot), false);
    assert.equal(resolveSafeExtractTarget(evil, [saveRoot]), null);
  });

  it("rejects relative zip-slip paths", () => {
    assert.equal(
      resolveSafeExtractTarget("..\\..\\startup\\evil.bat", [saveRoot]),
      null,
    );
    assert.equal(
      resolveSafeExtractTarget("../../etc/passwd", [saveRoot]),
      null,
    );
  });

  it("resolves benign relative entries inside the root", () => {
    const expected = path.win32.normalize(path.win32.join(saveRoot, "slot1", "save.dat"));
    assert.equal(
      resolveSafeExtractTarget("slot1/save.dat", [saveRoot]),
      expected,
    );
  });
});
