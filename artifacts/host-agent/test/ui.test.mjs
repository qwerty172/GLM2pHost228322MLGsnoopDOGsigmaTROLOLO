import { test } from "node:test";
import assert from "node:assert/strict";
import { installRendererEnv, RENDERER_DIST } from "./helpers/renderer-env.mjs";

installRendererEnv();

const { setStatus, setPipelineStep, log } = await import(new URL("ui.js", RENDERER_DIST).href);

test("setStatus updates dot and status text", () => {
  const dot = document.querySelector(".dot");
  const statusText = document.getElementById("status-text");
  setStatus("streaming", "Live now");
  assert.equal(dot.dataset.status, "streaming");
  assert.equal(statusText.textContent, "Live now");
});

test("setPipelineStep marks pipeline step state", () => {
  setPipelineStep("launch", "done", "Game X");
  const step = document.getElementById("step-launch");
  assert.equal(step.dataset.state, "done");
  assert.match(step.querySelector(".step-note").textContent, /Game X/);
});

test("log prepends timestamped message to log panel", () => {
  const logEl = document.getElementById("log");
  logEl.textContent = "";
  log("hello test");
  assert.match(logEl.textContent, /hello test/);
});
