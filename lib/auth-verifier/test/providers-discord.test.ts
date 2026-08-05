import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { DiscordProvider } from "../src/providers/discord.ts";

describe("DiscordProvider", () => {
  it("exposes name discord", () => {
    const provider = new DiscordProvider("bot-token");
    assert.equal(provider.name, "discord");
  });

  describe("sendOtp", () => {
    it("creates DM channel and sends OTP message", async () => {
      const calls: Array<{ url: string; init?: RequestInit }> = [];
      const restore = mock.method(
        globalThis,
        "fetch",
        async (url: string | URL | Request, init?: RequestInit) => {
          calls.push({ url: String(url), init });
          if (String(url).endsWith("/users/@me/channels")) {
            return {
              ok: true,
              json: async () => ({ id: "dm-123" }),
            } as Response;
          }
          return {
            ok: true,
            json: async () => ({ id: "msg-456" }),
          } as Response;
        },
      );

      try {
        const provider = new DiscordProvider("secret-bot");
        await provider.sendOtp("user-789", "654321");

        assert.equal(calls.length, 2);

        const [dmCall, msgCall] = calls;
        assert.equal(dmCall.url, "https://discord.com/api/v10/users/@me/channels");
        assert.equal(dmCall.init?.method, "POST");
        assert.deepEqual(JSON.parse(String(dmCall.init?.body)), {
          recipient_id: "user-789",
        });
        assert.equal(
          (dmCall.init?.headers as Record<string, string>).Authorization,
          "Bot secret-bot",
        );

        assert.equal(
          msgCall.url,
          "https://discord.com/api/v10/channels/dm-123/messages",
        );
        const msgBody = JSON.parse(String(msgCall.init?.body));
        assert.match(msgBody.content, /654321/);
        assert.match(msgBody.content, /DecentralHub/);
      } finally {
        restore.mock.restore();
      }
    });

    it("throws when DM channel creation fails", async () => {
      const restore = mock.method(globalThis, "fetch", async () => ({
        ok: false,
        status: 403,
        text: async () => "Forbidden",
      }));

      try {
        const provider = new DiscordProvider("bad-token");
        await assert.rejects(
          () => provider.sendOtp("user-1", "111111"),
          /Discord create DM failed: 403 Forbidden/,
        );
      } finally {
        restore.mock.restore();
      }
    });

    it("throws when message send fails", async () => {
      let call = 0;
      const restore = mock.method(globalThis, "fetch", async () => {
        call += 1;
        if (call === 1) {
          return {
            ok: true,
            json: async () => ({ id: "dm-1" }),
          } as Response;
        }
        return {
          ok: false,
          status: 500,
          text: async () => "Internal error",
        };
      });

      try {
        const provider = new DiscordProvider("token");
        await assert.rejects(
          () => provider.sendOtp("user-1", "222222"),
          /Discord send message failed: 500 Internal error/,
        );
      } finally {
        restore.mock.restore();
      }
    });
  });

  describe("parseMessage", () => {
    it("parses a valid DM message", () => {
      const result = DiscordProvider.parseMessage({
        content: "123456",
        author: {
          id: "111",
          username: "alice",
          global_name: "Alice",
          bot: false,
        },
      });

      assert.deepEqual(result, {
        userId: "111",
        content: "123456",
        username: "alice",
        globalName: "Alice",
      });
    });

    it("returns null for guild messages", () => {
      assert.equal(
        DiscordProvider.parseMessage({
          guild_id: "guild-1",
          content: "hi",
          author: { id: "1", bot: false },
        }),
        null,
      );
    });

    it("returns null for bot messages", () => {
      assert.equal(
        DiscordProvider.parseMessage({
          content: "hi",
          author: { id: "1", bot: true },
        }),
        null,
      );
    });

    it("returns null when author is missing", () => {
      assert.equal(DiscordProvider.parseMessage({ content: "hi" }), null);
    });

    it("returns null when content is missing or empty", () => {
      assert.equal(
        DiscordProvider.parseMessage({ author: { id: "1", bot: false } }),
        null,
      );
      assert.equal(
        DiscordProvider.parseMessage({
          content: "",
          author: { id: "1", bot: false },
        }),
        null,
      );
      assert.equal(
        DiscordProvider.parseMessage({
          content: 42,
          author: { id: "1", bot: false },
        }),
        null,
      );
    });

    it("sets username and globalName to null when absent", () => {
      const result = DiscordProvider.parseMessage({
        content: "otp",
        author: { id: "99", bot: false },
      });

      assert.deepEqual(result, {
        userId: "99",
        content: "otp",
        username: null,
        globalName: null,
      });
    });
  });
});
