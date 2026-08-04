import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const originalLoad = Module._load;

Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "electron") {
    return { app: { getAppPath: () => "/tmp/test-agent" } };
  }
  return originalLoad.call(this, request, parent, isMain);
};
