// Resolve the calling host from Authorization: Bearer / X-Host-Token /
// X-User-Token. Prefer headers so secrets never need to live in the URL.

import type { Request } from "express";
import { eq } from "drizzle-orm";
import { db, hostsTable } from "@workspace/db";
import { headerUserToken } from "./requestToken";

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

export async function requireHost(req: Request): Promise<
  | { ok: true; host: typeof hostsTable.$inferSelect }
  | { ok: false; status: number; error: string }
> {
  const hostToken = hostTokenFromRequest(req);
  if (!hostToken) {
    return { ok: false, status: 401, error: "hostToken required in Authorization or X-Host-Token" };
  }
  const [host] = await db
    .select()
    .from(hostsTable)
    .where(eq(hostsTable.hostToken, hostToken));
  if (!host) {
    return { ok: false, status: 404, error: "Host not found" };
  }
  return { ok: true, host };
}
