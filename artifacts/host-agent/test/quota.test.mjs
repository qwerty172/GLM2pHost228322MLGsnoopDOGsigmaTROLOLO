import { test } from "node:test";
import assert from "node:assert/strict";
import { setupRendererEnv } from "./helpers/renderer-env.mjs";

setupRendererEnv();
const { applyQuotaStatus, showAutoQuotaCard } = await import("../dist/renderer/renderer/quota.js");

test("applyQuotaStatus updates status text and actions visibility", () => {
  applyQuotaStatus({ statusText: "Квота найдена", hasAttached: true });
  assert.equal(document.getElementById("auto-quota-status").textContent, "Квота найдена");
  assert.equal(document.getElementById("auto-quota-actions").style.display, "block");

  applyQuotaStatus({ statusText: "Поиск…", hasAttached: false });
  assert.equal(document.getElementById("auto-quota-actions").style.display, "none");
});

test("showAutoQuotaCard reveals the card", () => {
  document.getElementById("auto-quota-card").hidden = true;
  showAutoQuotaCard();
  assert.equal(document.getElementById("auto-quota-card").hidden, false);
});
