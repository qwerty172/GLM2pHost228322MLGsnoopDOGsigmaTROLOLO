import { eq } from "drizzle-orm";
import type { Request } from "express";
import { db, hostsTable } from "@workspace/db";
import { timingSafeEqualString } from "./timingSafe";
import { hostTokenFromRequest } from "./hostAuth";

/**
 * Dev-key admin operations require either:
 *  - DEV_KEYS_CREATE_SECRET (or ADMIN_SECRET) via X-Dev-Key-Secret / X-Admin-Secret, or
 *  - a host token flagged isAdmin.
 * In non-production without a secret, set ALLOW_OPEN_DEV_KEY_CREATE=1 for local smoke.
 */
export async function authorizeDevKeyCreate(
  req: Request,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const secret = process.env.DEV_KEYS_CREATE_SECRET ?? process.env.ADMIN_SECRET;
  const providedRaw =
    req.headers["x-dev-key-secret"] ?? req.headers["x-admin-secret"];
  const provided = Array.isArray(providedRaw) ? providedRaw[0] : providedRaw;
  if (secret && provided && timingSafeEqualString(provided, secret)) {
    return { ok: true };
  }

  const hostToken = hostTokenFromRequest(req);
  if (hostToken) {
    const [row] = await db
      .select({ isAdmin: hostsTable.isAdmin })
      .from(hostsTable)
      .where(eq(hostsTable.hostToken, hostToken));
    if (row?.isAdmin === 1) return { ok: true };
  }

  if (
    process.env.NODE_ENV !== "production" &&
    process.env.ALLOW_OPEN_DEV_KEY_CREATE === "1"
  ) {
    return { ok: true };
  }

  return {
    ok: false,
    status: 401,
    error:
      "Dev key creation requires X-Dev-Key-Secret / admin host token (or ALLOW_OPEN_DEV_KEY_CREATE=1 in non-production)",
  };
}
