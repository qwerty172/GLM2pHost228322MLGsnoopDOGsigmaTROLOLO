import crypto from "node:crypto";
import type { VerifierConfig, ProviderName, UserType } from "./types.js";

/**
 * Alphabet for link tokens: uppercase alphanumeric, minus the characters that
 * are easy to misread when retyping a code from a screen into a chat (I, L, O,
 * U). Exactly 32 symbols, so masking a random byte with 31 is unbiased.
 *
 * Deliberately NOT base64url: that alphabet contains `-` and `_`, which are
 * awkward to type and, in Telegram, `_` is markdown syntax.
 */
const LINK_TOKEN_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ0123456789";
export const LINK_TOKEN_LENGTH = 8;

/** Random uppercase-alphanumeric token a user can retype without mistakes. */
export function generateLinkToken(length: number = LINK_TOKEN_LENGTH): string {
  const bytes = crypto.randomBytes(length);
  let token = "";
  for (const byte of bytes) {
    token += LINK_TOKEN_ALPHABET[byte & 31];
  }
  return token;
}

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
  const token = generateLinkToken();
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
