// Tiny in-process token-bucket rate limiter, keyed by route + caller. Good
// enough for v1 anti-fraud on credit-marketplace endpoints; replace with a
// shared-state limiter (Redis / Postgres advisory lock) when the API server
// scales horizontally.

import type { Request, Response, NextFunction, RequestHandler } from "express";

interface Bucket {
  tokens: number;
  updatedAt: number;
}

export function rateLimit(opts: {
  windowMs: number;
  max: number;
  keyFn?: (req: Request) => string;
  scope: string;
}): RequestHandler {
  const buckets = new Map<string, Bucket>();
  const refillPerMs = opts.max / opts.windowMs;
  const keyOf =
    opts.keyFn ??
    ((req: Request) => {
      const tok =
        (req.body && (req.body.userToken as string)) ||
        (req.query.userToken as string) ||
        "";
      return tok || req.ip || "anon";
    });

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = `${opts.scope}:${keyOf(req)}`;
    const existing = buckets.get(key) ?? { tokens: opts.max, updatedAt: now };
    const elapsed = now - existing.updatedAt;
    const tokens = Math.min(
      opts.max,
      existing.tokens + elapsed * refillPerMs,
    );
    if (tokens < 1) {
      const retryAfter = Math.ceil((1 - tokens) / refillPerMs / 1000);
      res.setHeader("Retry-After", String(Math.max(1, retryAfter)));
      res.status(429).json({ error: "Too many requests" });
      return;
    }
    buckets.set(key, { tokens: tokens - 1, updatedAt: now });
    next();
  };
}
