import type { OtpProvider } from "../types.js";

const DISCORD_API = "https://discord.com/api/v10";

export class DiscordProvider implements OtpProvider {
  readonly name = "discord" as const;

  constructor(private readonly botToken: string) {}

  /** Open a DM channel with the user and send an OTP. */
  async sendOtp(discordUserId: string, code: string): Promise<void> {
    // Step 1: create / get DM channel
    const dmRes = await fetch(`${DISCORD_API}/users/@me/channels`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${this.botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recipient_id: discordUserId }),
    });
    if (!dmRes.ok) {
      const body = await dmRes.text();
      throw new Error(`Discord create DM failed: ${dmRes.status} ${body}`);
    }
    const dm = (await dmRes.json()) as { id: string };

    // Step 2: send message
    const msgRes = await fetch(`${DISCORD_API}/channels/${dm.id}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${this.botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: `🔐 **Код подтверждения DecentralHub: \`${code}\`**\n> Действителен 5 минут. Никому не сообщайте.`,
      }),
    });
    if (!msgRes.ok) {
      const body = await msgRes.text();
      throw new Error(`Discord send message failed: ${msgRes.status} ${body}`);
    }
  }

  /**
   * Parse an incoming Discord interaction or DM event.
   * Handles MESSAGE_CREATE in DM channels.
   * Returns { userId, content, username } or null.
   */
  static parseMessage(body: unknown): {
    userId: string;
    content: string;
    username: string | null;
    globalName: string | null;
  } | null {
    const ev = body as Record<string, unknown>;
    // Only handle DM messages (guild_id absent) that are not from bots
    if (ev.guild_id !== undefined && ev.guild_id !== null) return null;
    const author = ev.author as Record<string, unknown> | undefined;
    if (!author || author.bot === true) return null;
    const content = typeof ev.content === "string" ? ev.content : null;
    if (!content) return null;
    return {
      userId: String(author.id),
      content,
      username: typeof author.username === "string" ? author.username : null,
      globalName:
        typeof author.global_name === "string" ? author.global_name : null,
    };
  }
}
