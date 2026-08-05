import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";

const MOCK_VERSION = "2.4.7-test";

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return {
      app: {
        getVersion: () => MOCK_VERSION,
      },
    };
  }
  return load.apply(this, arguments);
};

test("getAgentVersion returns app.getVersion() from Electron build metadata", async () => {
  const url = new URL("../dist/main/main/agent-version.js", import.meta.url);
  url.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  const { getAgentVersion } = await import(url.href);
  assert.equal(getAgentVersion(), MOCK_VERSION);
});
