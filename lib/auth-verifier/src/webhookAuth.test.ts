import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Request } from "express";
import {
  secretsMatch,
  telegramWebhookAuthorized,
  discordWebhookAuthorized,
} from "./webhookAuth.js";

function fakeReq(headers: Record<string, string> = {}): Request {
  return { headers } as Request;
}

describe("webhookAuth", () => {
  it("secretsMatch uses constant-time comparison", () => {
    assert.equal(secretsMatch("abc", "abc"), true);
    assert.equal(secretsMatch("abc", "abd"), false);
    assert.equal(secretsMatch("abc", "ab"), false);
  });

  it("telegramWebhookAuthorized requires configured secret and header", () => {
    const secret = "tg-secret-123";
    assert.equal(
      telegramWebhookAuthorized(
        fakeReq({ "x-telegram-bot-api-secret-token": secret }),
        secret,
      ),
      true,
    );
    assert.equal(
      telegramWebhookAuthorized(
        fakeReq({ "x-telegram-bot-api-secret-token": "wrong" }),
        secret,
      ),
      false,
    );
    assert.equal(telegramWebhookAuthorized(fakeReq(), secret), false);
    assert.equal(
      telegramWebhookAuthorized(
        fakeReq({ "x-telegram-bot-api-secret-token": secret }),
        undefined,
      ),
      false,
    );
  });

  it("discordWebhookAuthorized requires configured secret and header", () => {
    const secret = "discord-secret-456";
    assert.equal(
      discordWebhookAuthorized(
        fakeReq({ "x-discord-webhook-secret": secret }),
        secret,
      ),
      true,
    );
    assert.equal(
      discordWebhookAuthorized(
        fakeReq({ "x-discord-webhook-secret": "nope" }),
        secret,
      ),
      false,
    );
    assert.equal(discordWebhookAuthorized(fakeReq(), undefined), false);
  });
});
