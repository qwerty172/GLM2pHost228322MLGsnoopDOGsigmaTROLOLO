/**
 * Express router factory for the auth-verifier module.
 *
 * Mount it in your app:
 *   app.use("/api/verifier", createVerifierRouter(cfg, getUser));
 *
 * `getUser` extracts the authenticated user from the request.
 * Return null to signal "not authenticated" (router responds 401).
 */
import { Router, type Request, type Response, type NextFunction } from "express";
import { TelegramProvider } from "./providers/telegram.js";
import { DiscordProvider } from "./providers/discord.js";
import { startLinkFlow, confirmLinkToken } from "./link.js";
import { createChallenge, submitCode, getChallengeStatus } from "./challenge.js";
import type { VerifierConfig, ProviderName, UserType } from "./types.js";

export type AuthUser = { userId: string; userType: UserType };
export type GetUser = (req: Request) => AuthUser | null | Promise<AuthUser | null>;

function json(res: Response, status: number, body: unknown) {
  res.status(status).json(body);
}

function paramString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export function createVerifierRouter(cfg: VerifierConfig, getUser: GetUser): Router {
  const router = Router();

  // ── Auth middleware ─────────────────────────────────────────────────────
  async function requireUser(req: Request, res: Response, next: NextFunction) {
    const user = await getUser(req);
    if (!user) return json(res, 401, { error: "Unauthorized" });
    (req as Request & { verifierUser: AuthUser }).verifierUser = user;
    next();
  }

  function user(req: Request): AuthUser {
    return (req as Request & { verifierUser: AuthUser }).verifierUser;
  }

  // ── GET /status ─────────────────────────────────────────────────────────
  router.get("/status", requireUser, async (req: Request, res: Response) => {
    const { userId, userType } = user(req);
    const links = await cfg.db.getLinks(userId, userType);
    json(res, 200, {
      linked: links.map((l) => ({ provider: l.provider, username: l.providerUsername })),
      ready: links.length >= 2,
    });
  });

  // ── POST /link/start ─────────────────────────────────────────────────────
  // Body: { provider: "telegram" | "discord" }
  router.post("/link/start", requireUser, async (req: Request, res: Response) => {
    const provider = req.body?.provider as ProviderName | undefined;
    if (provider !== "telegram" && provider !== "discord") {
      return json(res, 400, { error: "provider must be 'telegram' or 'discord'" });
    }
    const { userId, userType } = user(req);
    const result = await startLinkFlow(cfg, userId, userType, provider);
    const botInstructions =
      provider === "telegram"
        ? "Откройте Telegram-бот и отправьте: /link " + result.token
        : "Напишите боту Discord в личные сообщения: /link " + result.token;
    json(res, 200, { ...result, instructions: botInstructions });
  });

  // ── POST /challenge ──────────────────────────────────────────────────────
  // Body: { purpose?: string }
  router.post("/challenge", requireUser, async (req: Request, res: Response) => {
    const { userId, userType } = user(req);
    const purpose = (req.body?.purpose as string | undefined) ?? "explicit";
    try {
      const result = await createChallenge(cfg, userId, userType, purpose);
      json(res, 201, result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown error";
      json(res, 422, { error: msg });
    }
  });

  // ── POST /challenge/:id/verify ───────────────────────────────────────────
  // Body: { provider: "telegram" | "discord", code: "123456" }
  router.post("/challenge/:id/verify", requireUser, async (req: Request, res: Response) => {
    const id = paramString(req.params.id);
    const provider = req.body?.provider as ProviderName | undefined;
    const code = req.body?.code as string | undefined;
    if (!provider || !code) {
      return json(res, 400, { error: "provider and code are required" });
    }
    const result = await submitCode(cfg, id, provider, code);
    json(res, result.ok ? 200 : 400, result);
  });

  // ── GET /challenge/:id ───────────────────────────────────────────────────
  router.get("/challenge/:id", requireUser, async (req: Request, res: Response) => {
    const status = await getChallengeStatus(cfg, paramString(req.params.id));
    json(res, 200, { status });
  });

  // ── POST /webhooks/telegram ──────────────────────────────────────────────
  // Telegram pushes updates here (set via setWebhook).
  // No auth — validated by Telegram's IP range in production (or a secret token).
  router.post("/webhooks/telegram", async (req: Request, res: Response) => {
    const update = TelegramProvider.parseUpdate(req.body);
    // Always respond 200 to Telegram immediately
    res.status(200).json({ ok: true });
    if (!update) return;

    const text = update.text.trim();
    const match = text.match(/^\/link\s+([A-Z0-9]{6,10})/i);
    if (!match) {
      // Optionally send a help message
      return;
    }

    const token = match[1];
    const result = await confirmLinkToken(cfg, token, update.chatId, update.username);

    // Find Telegram provider to send confirmation DM
    const tg = cfg.providers.find((p) => p.name === "telegram") as TelegramProvider | undefined;
    if (!tg) return;

    if (result.ok) {
      await tg.sendOtp(update.chatId, "✅").catch(() => {});
      // Override — send a proper confirmation message instead of OTP
      const confirmUrl = `https://api.telegram.org/bot${(tg as unknown as { botToken: string }).botToken}/sendMessage`;
      await fetch(confirmUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: update.chatId,
          text: `✅ Telegram успешно привязан к вашему аккаунту DecentralHub!`,
        }),
      }).catch(() => {});
    } else {
      // Send failure message
      const tgAny = tg as unknown as { botToken: string };
      const failUrl = `https://api.telegram.org/bot${tgAny.botToken}/sendMessage`;
      await fetch(failUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: update.chatId,
          text: `❌ Код недействителен или истёк. Запросите новый на сайте.`,
        }),
      }).catch(() => {});
    }
  });

  // ── POST /webhooks/discord ───────────────────────────────────────────────
  // Discord sends DM MESSAGE_CREATE events here via a gateway bot or webhook.
  router.post("/webhooks/discord", async (req: Request, res: Response) => {
    const msg = DiscordProvider.parseMessage(req.body);
    res.status(200).json({ ok: true });
    if (!msg) return;

    const text = msg.content.trim();
    const match = text.match(/^\/link\s+([A-Z0-9]{6,10})/i);
    if (!match) return;

    const token = match[1];
    const result = await confirmLinkToken(cfg, token, msg.userId, msg.username);

    const discord = cfg.providers.find((p) => p.name === "discord") as DiscordProvider | undefined;
    if (!discord) return;

    const replyText = result.ok
      ? "✅ Discord успешно привязан к вашему аккаунту DecentralHub!"
      : "❌ Код недействителен или истёк. Запросите новый на сайте.";
    await discord.sendOtp(msg.userId, replyText).catch(() => {});
  });

  return router;
}
