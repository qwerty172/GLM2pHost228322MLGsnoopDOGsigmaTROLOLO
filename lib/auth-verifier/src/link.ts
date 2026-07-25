import crypto from "node:crypto";
import type { VerifierConfig, ProviderName, UserType } from "./types.js";

/**
 * Start a link flow: generate a short token the user pastes into the bot.
 * Returns the token and its TTL.
 */
export async function startLinkFlow(
  cfg: VerifierConfig,
  userId: string,
  userType: UserType,
  provider: ProviderName,
): Promise<{ token: string; expiresIn: number }> {
  const ttl = cfg.linkTtlSec ?? 600;
  // 8-char uppercase alphanumeric, easy to type
  const token = crypto.randomBytes(5).toString("base64url").toUpperCase().slice(0, 8);
  await cfg.db.insertLinkToken({
    token,
    userId,
    userType,
    provider,
    expiresAt: new Date(Date.now() + ttl * 1000),
  });
  return { token, expiresIn: ttl };
}

/**
 * Called by a bot webhook when a user sends `/link <token>`.
 * Stores the provider↔user mapping and returns who was linked.
 */
export async function confirmLinkToken(
  cfg: VerifierConfig,
  rawToken: string,
  providerUserId: string,
  providerUsername: string | null,
): Promise<{
  ok: boolean;
  userId?: string;
  userType?: UserType;
  provider?: ProviderName;
}> {
  const token = rawToken.trim().toUpperCase();
  const row = await cfg.db.consumeLinkToken(token);
  if (!row) return { ok: false };

  await cfg.db.upsertLink({
    userId: row.userId,
    userType: row.userType,
    provider: row.provider,
    providerUserId,
    providerUsername,
  });

  return { ok: true, userId: row.userId, userType: row.userType, provider: row.provider };
}
