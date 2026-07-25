// JWT utilities for access tokens and WS tickets (dual-mode with legacy opaque tokens).

import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const ACCESS_TTL_SEC = 15 * 60;
const REFRESH_TTL_SEC = 30 * 24 * 60 * 60;
const WS_TICKET_TTL_SEC = 5 * 60;

export type UserType = "host" | "player";

export interface AccessClaims extends JWTPayload {
  sub: string;
  typ: UserType;
  kind: "access";
}

export interface WsTicketClaims extends JWTPayload {
  sub: string;
  typ: UserType;
  kind: "ws-ticket";
  sessionId?: string;
}

function secretKey(): Uint8Array {
  const raw = process.env["JWT_SECRET"]?.trim();
  if (!raw) throw new Error("JWT_SECRET is not configured");
  return new TextEncoder().encode(raw);
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function signAccessJwt(
  userId: string,
  userType: UserType,
): Promise<string> {
  return new SignJWT({ typ: userType, kind: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SEC}s`)
    .sign(secretKey());
}

export async function verifyAccessJwt(token: string): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.kind !== "access") return null;
    if (payload.typ !== "host" && payload.typ !== "player") return null;
    if (!payload.sub) return null;
    return payload as AccessClaims;
  } catch {
    return null;
  }
}

export async function signWsTicket(
  userId: string,
  userType: UserType,
  sessionId?: string,
): Promise<string> {
  return new SignJWT({ typ: userType, kind: "ws-ticket", sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${WS_TICKET_TTL_SEC}s`)
    .sign(secretKey());
}

export async function verifyWsTicket(token: string): Promise<WsTicketClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.kind !== "ws-ticket") return null;
    if (payload.typ !== "host" && payload.typ !== "player") return null;
    if (!payload.sub) return null;
    return payload as WsTicketClaims;
  } catch {
    return null;
  }
}

export { ACCESS_TTL_SEC, REFRESH_TTL_SEC, WS_TICKET_TTL_SEC };
