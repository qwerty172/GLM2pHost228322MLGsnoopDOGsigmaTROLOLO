import { test, before } from "node:test";
import assert from "node:assert/strict";
import { installRendererDom } from "./helpers/dom-setup.mjs";

let setPipelineStep;

before(async () => {
  installRendererDom();
  ({ setPipelineStep } = await import("../dist/renderer/renderer/ui.js"));
});

test("setPipelineStep updates pipeline step state", () => {
  setPipelineStep("launch", "done", "ok");
  const step = document.getElementById("step-launch");
  assert.equal(step.dataset.state, "done");
});
