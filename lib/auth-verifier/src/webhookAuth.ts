import crypto from "node:crypto";
import type { Request } from "express";

/** Constant-time string compare for webhook shared secrets. */
export function secretsMatch(expected: string, provided: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function readHeader(req: Request, name: string): string | undefined {
  const raw = req.headers[name.toLowerCase()];
  if (typeof raw === "string" && raw.length > 0) return raw;
  if (Array.isArray(raw) && raw[0]) return raw[0];
  return undefined;
}

export function telegramWebhookAuthorized(
  req: Request,
  secret: string | undefined,
): boolean {
  if (!secret) return false;
  const got = readHeader(req, "x-telegram-bot-api-secret-token");
  return got !== undefined && secretsMatch(secret, got);
}

export function discordWebhookAuthorized(
  req: Request,
  secret: string | undefined,
): boolean {
  if (!secret) return false;
  const got = readHeader(req, "x-discord-webhook-secret");
  return got !== undefined && secretsMatch(secret, got);
}
