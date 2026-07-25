// Helpers for reading the wallet/user token from the X-User-Token header.
//
// Tokens historically travelled in URL paths (/wallet/:userToken) and query
// params (?hostToken=...), which leaks them into browser history and server
// logs. Clients should now send the token in the `X-User-Token` header and
// use the literal `@me` placeholder in token path segments; a middleware in
// app.ts substitutes the header token back into the path so existing route
// handlers keep working unchanged. Query-token routes call headerUserToken()
// directly and fall back to the legacy query param.

import type { Request } from "express";

export const USER_TOKEN_HEADER = "x-user-token";

/** Path segment clients send in place of a raw token when using the header. */
export const TOKEN_PLACEHOLDER = "@me";

export function headerUserToken(req: Request): string | null {
  const raw = req.headers[USER_TOKEN_HEADER];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Host token from Authorization: Bearer / X-Host-Token / X-User-Token. */
export function hostTokenFromRequest(req: Request): string | null {
  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")) {
    const tok = auth.slice(7).trim();
    if (tok) return tok;
  }
  const xHost = req.headers["x-host-token"];
  if (typeof xHost === "string" && xHost.trim()) return xHost.trim();
  if (Array.isArray(xHost) && xHost[0]?.trim()) return xHost[0].trim();
  return headerUserToken(req);
}
