import { test } from "node:test";
import assert from "node:assert/strict";

const {
  QUOTA_AI_CHAT_STARTERS,
  canSendQuotaAiMessage,
  shouldSubmitQuotaAiOnEnter,
} = await import("../src/components/quota-ai-chat.tsx");

test("QUOTA_AI_CHAT_STARTERS lists three Russian example prompts", () => {
  assert.equal(QUOTA_AI_CHAT_STARTERS.length, 3);
  assert.match(QUOTA_AI_CHAT_STARTERS[0], /Спонсирую плейтест/);
  assert.match(QUOTA_AI_CHAT_STARTERS[1], /royalty/);
  assert.match(QUOTA_AI_CHAT_STARTERS[2], /Бесплатные 30 минут/);
});

test("canSendQuotaAiMessage rejects empty and whitespace-only input", () => {
  assert.equal(canSendQuotaAiMessage("", false), false);
  assert.equal(canSendQuotaAiMessage("   ", false), false);
  assert.equal(canSendQuotaAiMessage("\t\n", false), false);
});

test("canSendQuotaAiMessage rejects input while loading", () => {
  assert.equal(canSendQuotaAiMessage("Привет", true), false);
  assert.equal(canSendQuotaAiMessage("  Привет  ", true), false);
});

test("canSendQuotaAiMessage accepts non-empty trimmed input when not loading", () => {
  assert.equal(canSendQuotaAiMessage("Привет", false), true);
  assert.equal(canSendQuotaAiMessage("  Бюджет 50000 LZT  ", false), true);
});

test("shouldSubmitQuotaAiOnEnter submits on Enter without Shift", () => {
  assert.equal(shouldSubmitQuotaAiOnEnter({ key: "Enter", shiftKey: false }), true);
});

test("shouldSubmitQuotaAiOnEnter ignores Shift+Enter and other keys", () => {
  assert.equal(shouldSubmitQuotaAiOnEnter({ key: "Enter", shiftKey: true }), false);
  assert.equal(shouldSubmitQuotaAiOnEnter({ key: "a", shiftKey: false }), false);
  assert.equal(shouldSubmitQuotaAiOnEnter({ key: "Tab", shiftKey: false }), false);
});
