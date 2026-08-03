import "../test/setup-renderer-dom.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { elements } from "../test/setup-renderer-dom.mjs";

const { setStatus, setPipelineStep, resetPipeline } = await import("../dist/renderer/renderer/ui.js");

test("setStatus updates dot and text", () => {
  const dot = document.querySelector(".dot");
  const text = elements.get("status-text");
  setStatus("streaming", "Live now");
  assert.equal(dot.dataset.status, "streaming");
  assert.equal(text.textContent, "Live now");
});

test("setPipelineStep marks step active", () => {
  const step = elements.get("step-window");
  setPipelineStep("window", "active", "matching");
  assert.equal(step.dataset.state, "active");
});

test("resetPipeline resets all steps to pending", () => {
  resetPipeline(true);
  for (const id of ["step-saves", "step-launch", "step-window", "step-stream", "step-player"]) {
    assert.equal(elements.get(id).dataset.state, "pending");
  }
});
