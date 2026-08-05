import { test } from "node:test";
import assert from "node:assert/strict";

const {
  QUOTA_AI_CHAT_STARTERS,
  canSendQuotaChatMessage,
  shouldSubmitQuotaChatOnEnter,
  hasQuotaFormPatch,
  formatQuotaAiChatError,
} = await import("../src/lib/quota-ai-chat.ts");

test("QUOTA_AI_CHAT_STARTERS lists three Russian prompt examples", () => {
  assert.equal(QUOTA_AI_CHAT_STARTERS.length, 3);
  assert.match(QUOTA_AI_CHAT_STARTERS[0], /Cyberpunk/);
  assert.match(QUOTA_AI_CHAT_STARTERS[1], /royalty/);
  assert.match(QUOTA_AI_CHAT_STARTERS[2], /новичкам/);
});

test("canSendQuotaChatMessage rejects empty and whitespace-only input", () => {
  assert.equal(canSendQuotaChatMessage("", false), false);
  assert.equal(canSendQuotaChatMessage("   ", false), false);
  assert.equal(canSendQuotaChatMessage("\t\n", false), false);
});

test("canSendQuotaChatMessage rejects input while loading", () => {
  assert.equal(canSendQuotaChatMessage("Привет", true), false);
  assert.equal(canSendQuotaChatMessage("  текст  ", true), false);
});

test("canSendQuotaChatMessage accepts non-empty trimmed input when idle", () => {
  assert.equal(canSendQuotaChatMessage("Спонсирую плейтест", false), true);
  assert.equal(canSendQuotaChatMessage("  бюджет 50000  ", false), true);
});

test("shouldSubmitQuotaChatOnEnter submits on Enter without Shift", () => {
  assert.equal(shouldSubmitQuotaChatOnEnter("Enter", false), true);
  assert.equal(shouldSubmitQuotaChatOnEnter("Enter", true), false);
  assert.equal(shouldSubmitQuotaChatOnEnter("a", false), false);
  assert.equal(shouldSubmitQuotaChatOnEnter("Tab", false), false);
});

test("hasQuotaFormPatch detects non-empty patches", () => {
  assert.equal(hasQuotaFormPatch(null), false);
  assert.equal(hasQuotaFormPatch(undefined), false);
  assert.equal(hasQuotaFormPatch({}), false);
  assert.equal(hasQuotaFormPatch({ title: "Плейтест" }), true);
  assert.equal(hasQuotaFormPatch({ budgetLzt: 50000, kind: "sponsor" }), true);
});

test("formatQuotaAiChatError uses Russian fallback for unknown errors", () => {
  assert.equal(formatQuotaAiChatError(null), "Не удалось связаться с ИИ. Попробуй ещё раз.");
  assert.match(formatQuotaAiChatError({ message: "fetch failed" }), /сети/i);
});
