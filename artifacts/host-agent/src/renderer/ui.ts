import type { AgentStatus } from "../shared/messages";
import { logEl, statusDot, statusText } from "./dom.js";

export type PipelineStep = "saves" | "launch" | "window" | "stream" | "player";
export type PipelineState = "pending" | "active" | "done" | "error";

const pipelineCard = document.getElementById("pipeline-card") as HTMLElement;

export function setStatus(status: AgentStatus, message?: string): void {
  statusDot.dataset["status"] = status;
  statusText.textContent =
    message ??
    {
      idle: "Idle — waiting for player",
      connecting: "Connecting…",
      streaming: "Streaming",
      error: "Error",
    }[status];
  window.agent.setStatus(status, message);
}

export function setPipelineStep(step: PipelineStep, state: PipelineState, note = ""): void {
  pipelineCard.hidden = false;
  const li = document.getElementById(`step-${step}`);
  if (!li) return;
  li.dataset["state"] = state;
  const icon = li.querySelector<HTMLSpanElement>(".step-icon");
  if (icon) {
    icon.textContent =
      state === "done" ? "✅" : state === "active" ? "⏳" : state === "error" ? "❌" : "○";
  }
  const noteEl = li.querySelector<HTMLSpanElement>(".step-note");
  if (noteEl) noteEl.textContent = note ? ` — ${note}` : "";
}

export function resetPipeline(show: boolean): void {
  for (const step of ["saves", "launch", "window", "stream", "player"] as PipelineStep[]) {
    setPipelineStep(step, "pending");
  }
  pipelineCard.hidden = !show;
}

export function log(msg: string): void {
  const stamp = new Date().toLocaleTimeString();
  logEl.textContent = `[${stamp}] ${msg}\n` + logEl.textContent;
  if (logEl.textContent.length > 16_000) {
    logEl.textContent = logEl.textContent.slice(0, 16_000);
  }
  window.agent.log("info", msg);
}
