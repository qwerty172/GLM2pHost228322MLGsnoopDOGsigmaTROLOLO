import { test } from "node:test";
import assert from "node:assert/strict";

const {
  QUOTA_AI_CHAT_STARTERS,
  shouldSendQuotaMessageOnEnter,
  canSendQuotaMessage,
  hasQuotaFormPatch,
} = await import("../src/components/quota-ai-chat.tsx");

test("QUOTA_AI_CHAT_STARTERS lists three Russian prompt examples", () => {
  assert.equal(QUOTA_AI_CHAT_STARTERS.length, 3);
  assert.match(QUOTA_AI_CHAT_STARTERS[0], /Cyberpunk/);
  assert.match(QUOTA_AI_CHAT_STARTERS[1], /royalty/);
  assert.match(QUOTA_AI_CHAT_STARTERS[2], /новичкам/);
});

test("shouldSendQuotaMessageOnEnter sends on Enter without Shift", () => {
  assert.equal(shouldSendQuotaMessageOnEnter("Enter", false), true);
  assert.equal(shouldSendQuotaMessageOnEnter("Enter", true), false);
  assert.equal(shouldSendQuotaMessageOnEnter("a", false), false);
});

test("canSendQuotaMessage rejects empty or loading state", () => {
  assert.equal(canSendQuotaMessage("", false), false);
  assert.equal(canSendQuotaMessage("   ", false), false);
  assert.equal(canSendQuotaMessage("привет", true), false);
});

test("canSendQuotaMessage accepts non-empty text when idle", () => {
  assert.equal(canSendQuotaMessage("привет", false), true);
  assert.equal(canSendQuotaMessage("  квота  ", false), true);
});

test("hasQuotaFormPatch detects non-empty patches", () => {
  assert.equal(hasQuotaFormPatch(null), false);
  assert.equal(hasQuotaFormPatch(undefined), false);
  assert.equal(hasQuotaFormPatch({}), false);
  assert.equal(hasQuotaFormPatch({ title: "Test" }), true);
});
