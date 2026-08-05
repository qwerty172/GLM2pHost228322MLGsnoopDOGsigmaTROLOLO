import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { TelegramProvider } from "../src/providers/telegram.ts";

describe("TelegramProvider", () => {
  it("exposes name telegram", () => {
    const provider = new TelegramProvider("bot-token");
    assert.equal(provider.name, "telegram");
  });

  describe("sendOtp", () => {
    it("sends OTP message to chat", async () => {
      const calls: Array<{ url: string; init?: RequestInit }> = [];
      const restore = mock.method(
        globalThis,
        "fetch",
        async (url: string | URL | Request, init?: RequestInit) => {
          calls.push({ url: String(url), init });
          return { ok: true } as Response;
        },
      );

      try {
        const provider = new TelegramProvider("secret-bot");
        await provider.sendOtp("chat-42", "654321");

        assert.equal(calls.length, 1);
        const [call] = calls;
        assert.equal(
          call.url,
          "https://api.telegram.org/botsecret-bot/sendMessage",
        );
        assert.equal(call.init?.method, "POST");
        assert.equal(
          (call.init?.headers as Record<string, string>)["Content-Type"],
          "application/json",
        );
        const body = JSON.parse(String(call.init?.body));
        assert.equal(body.chat_id, "chat-42");
        assert.equal(body.parse_mode, "Markdown");
        assert.match(body.text, /654321/);
        assert.match(body.text, /DecentralHub/);
      } finally {
        restore.mock.restore();
      }
    });

    it("throws when sendMessage fails", async () => {
      const restore = mock.method(globalThis, "fetch", async () => ({
        ok: false,
        status: 400,
        text: async () => "Bad Request",
      }));

      try {
        const provider = new TelegramProvider("bad-token");
        await assert.rejects(
          () => provider.sendOtp("chat-1", "111111"),
          /Telegram sendMessage failed: 400 Bad Request/,
        );
      } finally {
        restore.mock.restore();
      }
    });
  });

  describe("setWebhook", () => {
    it("registers webhook URL", async () => {
      const calls: Array<{ url: string; init?: RequestInit }> = [];
      const restore = mock.method(
        globalThis,
        "fetch",
        async (url: string | URL | Request, init?: RequestInit) => {
          calls.push({ url: String(url), init });
          return { ok: true } as Response;
        },
      );

      try {
        const provider = new TelegramProvider("secret-bot");
        await provider.setWebhook("https://example.com/tg-webhook");

        assert.equal(calls.length, 1);
        const [call] = calls;
        assert.equal(
          call.url,
          "https://api.telegram.org/botsecret-bot/setWebhook",
        );
        assert.equal(call.init?.method, "POST");
        assert.deepEqual(JSON.parse(String(call.init?.body)), {
          url: "https://example.com/tg-webhook",
        });
      } finally {
        restore.mock.restore();
      }
    });

    it("throws when setWebhook fails", async () => {
      const restore = mock.method(globalThis, "fetch", async () => ({
        ok: false,
        status: 500,
        text: async () => "Internal error",
      }));

      try {
        const provider = new TelegramProvider("token");
        await assert.rejects(
          () => provider.setWebhook("https://example.com/hook"),
          /Telegram setWebhook failed: 500 Internal error/,
        );
      } finally {
        restore.mock.restore();
      }
    });
  });

  describe("parseUpdate", () => {
    it("parses a valid private text message", () => {
      const result = TelegramProvider.parseUpdate({
        message: {
          text: "123456",
          chat: { id: 987654321, type: "private" },
          from: { username: "alice", first_name: "Alice" },
        },
      });

      assert.deepEqual(result, {
        chatId: "987654321",
        text: "123456",
        username: "alice",
        firstName: "Alice",
      });
    });

    it("returns null for non-private chats", () => {
      assert.equal(
        TelegramProvider.parseUpdate({
          message: {
            text: "hi",
            chat: { id: 1, type: "group" },
            from: { username: "bob" },
          },
        }),
        null,
      );
    });

    it("returns null when message is missing", () => {
      assert.equal(TelegramProvider.parseUpdate({ update_id: 1 }), null);
    });

    it("returns null when text is missing or not a string", () => {
      assert.equal(
        TelegramProvider.parseUpdate({
          message: {
            chat: { id: 1, type: "private" },
            from: { username: "bob" },
          },
        }),
        null,
      );
      assert.equal(
        TelegramProvider.parseUpdate({
          message: {
            text: 42,
            chat: { id: 1, type: "private" },
            from: { username: "bob" },
          },
        }),
        null,
      );
    });

    it("sets username and firstName to null when absent", () => {
      const result = TelegramProvider.parseUpdate({
        message: {
          text: "otp",
          chat: { id: 99, type: "private" },
          from: {},
        },
      });

      assert.deepEqual(result, {
        chatId: "99",
        text: "otp",
        username: null,
        firstName: null,
      });
    });
  });
});
