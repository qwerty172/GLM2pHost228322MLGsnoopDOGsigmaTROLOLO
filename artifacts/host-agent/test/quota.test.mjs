import { test, before } from "node:test";
import assert from "node:assert/strict";
import { installRendererDom } from "./helpers/dom-setup.mjs";

let applyQuotaStatus;
let autoQuotaCard;

before(async () => {
  installRendererDom();
  ({ applyQuotaStatus, autoQuotaCard } = await import("../dist/renderer/renderer/quota.js"));
});

test("applyQuotaStatus updates status text", () => {
  applyQuotaStatus({ statusText: "Тест квоты", hasAttached: true });
  const status = document.getElementById("auto-quota-status");
  assert.equal(status.textContent, "Тест квоты");
  assert.equal(autoQuotaCard.id, "auto-quota-card");
});
