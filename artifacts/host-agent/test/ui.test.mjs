import { test } from "node:test";
import assert from "node:assert/strict";
import { setupRendererEnv } from "./helpers/renderer-env.mjs";

setupRendererEnv();
const { setStatus, setPipelineStep, resetPipeline } = await import("../dist/renderer/renderer/ui.js");
const { statusDot, statusText } = await import("../dist/renderer/renderer/dom.js");

test("setStatus updates status text and dot dataset", () => {
  setStatus("streaming", "Custom message");
  assert.equal(statusDot.dataset.status, "streaming");
  assert.equal(statusText.textContent, "Custom message");
});

test("setPipelineStep marks a pipeline step", () => {
  setPipelineStep("launch", "done", "ok");
  const li = document.getElementById("step-launch");
  assert.equal(li.dataset.state, "done");
  assert.match(li.querySelector(".step-note").textContent, /ok/);
});

test("resetPipeline hides card when show=false", () => {
  resetPipeline(false);
  assert.equal(document.getElementById("pipeline-card").hidden, true);
});
