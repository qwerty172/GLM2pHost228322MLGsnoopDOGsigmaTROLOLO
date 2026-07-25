import type { OtpProvider } from "../types.js";

export class TelegramProvider implements OtpProvider {
  readonly name = "telegram" as const;

  constructor(private readonly botToken: string) {}

  async sendOtp(chatId: string, code: string): Promise<void> {
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `🔐 Ваш код подтверждения DecentralHub: *${code}*\n\nДействителен 5 минут. Никому не сообщайте.`,
        parse_mode: "Markdown",
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Telegram sendMessage failed: ${res.status} ${body}`);
    }
  }

  /**
   * Parse an incoming Telegram webhook update.
   * Returns { chatId, text, username } if it's a private text message, null otherwise.
   */
  static parseUpdate(body: unknown): {
    chatId: string;
    text: string;
    username: string | null;
    firstName: string | null;
  } | null {
    const u = body as Record<string, unknown>;
    const msg = u?.message as Record<string, unknown> | undefined;
    if (!msg) return null;
    const chat = msg.chat as Record<string, unknown> | undefined;
    if (!chat || chat.type !== "private") return null;
    const text = typeof msg.text === "string" ? msg.text : null;
    if (!text) return null;
    const from = msg.from as Record<string, unknown> | undefined;
    return {
      chatId: String(chat.id),
      text,
      username: typeof from?.username === "string" ? from.username : null,
      firstName: typeof from?.first_name === "string" ? from.first_name : null,
    };
  }

  /**
   * Register a webhook URL with Telegram so updates are pushed to your server.
   * Call this once on startup if TELEGRAM_WEBHOOK_URL is set.
   */
  async setWebhook(webhookUrl: string): Promise<void> {
    const url = `https://api.telegram.org/bot${this.botToken}/setWebhook`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Telegram setWebhook failed: ${res.status} ${body}`);
    }
  }
}
