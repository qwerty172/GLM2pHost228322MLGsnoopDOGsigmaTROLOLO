import type { RequestHandler } from "express";
import { eq } from "drizzle-orm";
import { db, hostsTable } from "@workspace/db";
import { timingSafeEqualString } from "./timingSafe";

function getHostToken(req: {
  headers: Record<string, string | string[] | undefined>;
}): string | null {
  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")) {
    const tok = auth.slice(7).trim();
    if (tok) return tok;
  }
  const xHost = req.headers["x-host-token"];
  if (typeof xHost === "string" && xHost.trim()) return xHost.trim();
  if (Array.isArray(xHost) && xHost[0]?.trim()) return xHost[0].trim();
  return null;
}

export const requireAdmin: RequestHandler = async (req, res, next) => {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    res.status(503).json({
      error: "admin_disabled",
      message: "ADMIN_SECRET is not configured on the server",
    });
    return;
  }

  const providedSecretRaw = req.headers["x-admin-secret"];
  const providedSecret = Array.isArray(providedSecretRaw)
    ? providedSecretRaw[0]
    : providedSecretRaw;
  if (!providedSecret || !timingSafeEqualString(providedSecret, adminSecret)) {
    res.status(403).json({
      error: "admin_secret_required",
      message: "Missing or invalid X-Admin-Secret header",
    });
    return;
  }

  const token = getHostToken(req);
  if (!token) {
    res.status(401).json({ error: "Missing X-Host-Token header" });
    return;
  }

  const [host] = await db
    .select({ id: hostsTable.id, isAdmin: hostsTable.isAdmin })
    .from(hostsTable)
    .where(eq(hostsTable.hostToken, token));

  if (!host) {
    res.status(401).json({ error: "Unknown host token" });
    return;
  }
  if (!host.isAdmin) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  (req as { adminHostId?: string }).adminHostId = host.id;
  next();
};
