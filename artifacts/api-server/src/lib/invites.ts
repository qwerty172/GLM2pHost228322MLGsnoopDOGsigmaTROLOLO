import { randomBytes } from "node:crypto";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Short URL-safe invite code (12 chars). */
export function generateInviteCode(): string {
  return randomBytes(9).toString("base64url");
}

export function defaultInviteExpiresAt(from = new Date()): Date {
  return new Date(from.getTime() + INVITE_TTL_MS);
}

export function isInviteExpired(expiresAt: Date | null | undefined, now = new Date()): boolean {
  if (!expiresAt) return false;
  return now.getTime() > new Date(expiresAt).getTime();
}

export type InviteSessionLike = {
  status: string;
  claimedByPlayerId: string | null;
  devKeyId?: string | null;
  inviteExpiresAt: Date | null;
};

/** Unclaimed lobby with expired invite — blocks host_busy but is not joinable. */
export function isStaleUnclaimedInviteSession(
  session: InviteSessionLike,
  now = new Date(),
): boolean {
  if (session.status === "ended") return false;
  if (session.claimedByPlayerId) return false;
  if (session.devKeyId) return false;
  return isInviteExpired(session.inviteExpiresAt, now);
}
