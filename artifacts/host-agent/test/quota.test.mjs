import "../test/setup-renderer-dom.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { elements } from "../test/setup-renderer-dom.mjs";

const { showAutoQuotaCard, applyQuotaStatus } = await import("../dist/renderer/renderer/quota.js");

test("showAutoQuotaCard reveals the card", () => {
  const card = elements.get("auto-quota-card");
  card.hidden = true;
  showAutoQuotaCard();
  assert.equal(card.hidden, false);
});

test("applyQuotaStatus updates text and actions visibility", () => {
  const status = elements.get("auto-quota-status");
  const actions = elements.get("auto-quota-actions");
  applyQuotaStatus({ statusText: "Ищу квоты…", hasAttached: true });
  assert.equal(status.textContent, "Ищу квоты…");
  assert.equal(actions.style.display, "block");
  applyQuotaStatus({ statusText: "Выключен", hasAttached: false });
  assert.equal(actions.style.display, "none");
});
