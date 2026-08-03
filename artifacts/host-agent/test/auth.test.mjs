import { test, before } from "node:test";
import assert from "node:assert/strict";
import { installRendererDom } from "./helpers/dom-setup.mjs";

let showSigninBanner;

before(async () => {
  installRendererDom();
  ({ showSigninBanner } = await import("../dist/renderer/renderer/auth.js"));
});

test("showSigninBanner sets display name and hostname", () => {
  showSigninBanner("Test Host", "https://api.example.com");
  const name = document.getElementById("signin-display-name");
  const host = document.getElementById("signin-api-url");
  assert.equal(name.textContent, "Test Host");
  assert.equal(host.textContent, "api.example.com");
});
