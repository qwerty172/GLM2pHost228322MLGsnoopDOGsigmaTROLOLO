import { test } from "node:test";
import assert from "node:assert/strict";
import { installRendererEnv, RENDERER_DIST } from "./helpers/renderer-env.mjs";

installRendererEnv();

const { showAutoQuotaCard, applyQuotaStatus } = await import(new URL("quota.js", RENDERER_DIST).href);

test("showAutoQuotaCard reveals quota section", () => {
  const card = document.getElementById("auto-quota-card");
  card.hidden = true;
  showAutoQuotaCard();
  assert.equal(card.hidden, false);
});

test("applyQuotaStatus updates status text and actions visibility", () => {
  const status = document.getElementById("auto-quota-status");
  const actions = document.getElementById("auto-quota-actions");
  applyQuotaStatus({ statusText: "Тест статус", hasAttached: true });
  assert.equal(status.textContent, "Тест статус");
  assert.equal(actions.style.display, "block");
});
