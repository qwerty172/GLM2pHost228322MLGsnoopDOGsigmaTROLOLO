import { test, before } from "node:test";
import assert from "node:assert/strict";
import { installRendererDom } from "./helpers/dom-setup.mjs";

let exeBasename;

before(async () => {
  installRendererDom();
  ({ exeBasename } = await import("../dist/renderer/renderer/capture.js"));
});

test("exeBasename strips extension and lowercases", () => {
  assert.equal(exeBasename("C:\\Games\\Doom.exe"), "doom");
  assert.equal(exeBasename(undefined), undefined);
});
