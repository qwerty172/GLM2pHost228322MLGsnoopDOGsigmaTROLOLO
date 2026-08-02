/**
 * Mounts the @workspace/auth-verifier router at /api/verifier.
 *
 * Env vars required:
 *   TELEGRAM_BOT_TOKEN        — Telegram bot token from @BotFather
 *   DISCORD_BOT_TOKEN         — Discord bot token from Discord Developer Portal
 *   TELEGRAM_WEBHOOK_URL      — (optional) full URL for Telegram to push updates to
 *   TELEGRAM_WEBHOOK_SECRET   — shared secret for Telegram webhook auth
 *   DISCORD_WEBHOOK_SECRET    — shared secret for Discord webhook auth
 */
import { Router } from "express";
import {
  createVerifierRouter,
  TelegramProvider,
  DiscordProvider,
} from "@workspace/auth-verifier";
import { verifierDb } from "../lib/verifierDb.js";
import { resolveAuthUser } from "./auth.js";
import type { Request } from "express";

const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const discordToken = process.env.DISCORD_BOT_TOKEN;
const telegramWebhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
const discordWebhookSecret = process.env.DISCORD_WEBHOOK_SECRET;

const providers = [
  ...(telegramToken ? [new TelegramProvider(telegramToken)] : []),
  ...(discordToken ? [new DiscordProvider(discordToken)] : []),
];

if (providers.length === 0) {
  console.warn(
    "[verifier] No bot tokens configured — TELEGRAM_BOT_TOKEN and DISCORD_BOT_TOKEN are both unset. " +
      "Verifier routes will be mounted but OTP delivery will fail.",
  );
}

// Register Telegram webhook on startup (non-blocking)
if (telegramToken && process.env.TELEGRAM_WEBHOOK_URL) {
  if (!telegramWebhookSecret) {
    console.warn(
      "[verifier] TELEGRAM_WEBHOOK_SECRET is unset — Telegram link webhooks will reject all traffic until configured.",
    );
  }
  const tg = providers.find((p) => p.name === "telegram") as
    | TelegramProvider
    | undefined;
  tg
    ?.setWebhook(process.env.TELEGRAM_WEBHOOK_URL, telegramWebhookSecret)
    .then(() =>
      console.info(
        `[verifier] Telegram webhook set → ${process.env.TELEGRAM_WEBHOOK_URL}`,
      ),
    )
    .catch((e) => console.warn("[verifier] Telegram setWebhook failed:", e));
}

if (discordToken && !discordWebhookSecret) {
  console.warn(
    "[verifier] DISCORD_WEBHOOK_SECRET is unset — Discord link webhooks will reject all traffic until configured.",
  );
}

const verifierRouter = createVerifierRouter(
  {
    db: verifierDb,
    providers,
    webhookSecrets: {
      telegram: telegramWebhookSecret,
      discord: discordWebhookSecret,
    },
  },
  async (req: Request) => {
    // Reuse the existing JWT-based auth resolver
    return resolveAuthUser(req);
  },
);

const router = Router();
router.use("/verifier", verifierRouter);

export default router;
