// Rate limiter with Redis (primary), optional PostgreSQL backing, and in-memory fallback.

import type { Request, Response, NextFunction, RequestHandler } from "express";
import { logger } from "./logger";
import { getRedis, isRedisAvailable } from "./redis";

interface Bucket {
  tokens: number;
  updatedAt: number;
}

const memoryBuckets = new Map<string, Bucket>();
const memoryFailures = new Map<
  string,
  { consecutiveFailures: number; lockedUntil: number; updatedAt: number }
>();

function usePostgres(): boolean {
  return process.env.RATE_LIMIT_STORAGE !== "memory";
}

async function getDb() {
  const { db } = await import("@workspace/db");
  return db;
}

export function ipKey(req: Request): string {
  return req.ip || "anon";
}

async function refillBucket(
  key: string,
  windowMs: number,
  max: number,
): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const now = Date.now();
  const refillPerMs = max / windowMs;

  if (isRedisAvailable()) {
    const redis = getRedis();
    if (redis) {
      try {
        const count = await redis.incr(key);
        if (count === 1) {
          await redis.expire(key, Math.ceil(windowMs / 1000));
        }
        if (count > max) {
          const ttl = await redis.expire(key, Math.ceil(windowMs / 1000));
          void ttl;
          const retryAfterSec = Math.ceil(windowMs / 1000);
          return { allowed: false, retryAfterSec: Math.max(1, retryAfterSec) };
        }
        return { allowed: true, retryAfterSec: 0 };
      } catch (err) {
        logger.warn({ err, key }, "Redis rate limit failed; falling back");
      }
    }
  }

  if (usePostgres()) {
    try {
      const { eq } = await import("drizzle-orm");
      const { rateLimitBucketsTable } = await import("@workspace/db");
      const db = await getDb();
      const result = await db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(rateLimitBucketsTable)
          .where(eq(rateLimitBucketsTable.key, key));

        const base = existing ?? {
          key,
          tokens: max,
          updatedAt: new Date(now),
          windowMs,
          max,
        };

        const updatedAtMs = existing
          ? new Date(existing.updatedAt).getTime()
          : now;
        const elapsed = now - updatedAtMs;
        const tokens = Math.min(
          max,
          (existing?.tokens ?? max) + elapsed * refillPerMs,
        );

        if (tokens < 1) {
          const retryAfterSec = Math.ceil((1 - tokens) / refillPerMs / 1000);
          return { allowed: false, retryAfterSec: Math.max(1, retryAfterSec) };
        }

        await tx
          .insert(rateLimitBucketsTable)
          .values({
            key,
            tokens: tokens - 1,
            updatedAt: new Date(now),
            windowMs,
            max,
          })
          .onConflictDoUpdate({
            target: rateLimitBucketsTable.key,
            set: {
              tokens: tokens - 1,
              updatedAt: new Date(now),
              windowMs,
              max,
            },
          });

        return { allowed: true, retryAfterSec: 0 };
      });
      return result;
    } catch (err) {
      logger.warn({ err, key }, "Postgres rate limit failed; falling back to memory");
    }
  }

  const existing = memoryBuckets.get(key) ?? { tokens: max, updatedAt: now };
  const elapsed = now - existing.updatedAt;
  const tokens = Math.min(max, existing.tokens + elapsed * refillPerMs);
  if (tokens < 1) {
    const retryAfterSec = Math.ceil((1 - tokens) / refillPerMs / 1000);
    return { allowed: false, retryAfterSec: Math.max(1, retryAfterSec) };
  }
  memoryBuckets.set(key, { tokens: tokens - 1, updatedAt: now });
  return { allowed: true, retryAfterSec: 0 };
}

export function rateLimit(opts: {
  windowMs: number;
  max: number;
  keyFn?: (req: Request) => string;
  scope: string;
}): RequestHandler {
  const keyOf =
    opts.keyFn ??
    ((req: Request) => {
      const hdr = req.headers["x-user-token"];
      const tok =
        (typeof hdr === "string" ? hdr : Array.isArray(hdr) ? hdr[0] : "") ||
        (req.body && (req.body.userToken as string)) ||
        (req.query.userToken as string) ||
        "";
      return tok || req.ip || "anon";
    });

  return async (req: Request, res: Response, next: NextFunction) => {
    const key = `${opts.scope}:${keyOf(req)}`;
    const { allowed, retryAfterSec } = await refillBucket(
      key,
      opts.windowMs,
      opts.max,
    );
    if (!allowed) {
      res.setHeader("Retry-After", String(retryAfterSec));
      res.status(429).json({
        error: "too_many_requests",
        message: "Слишком много запросов, попробуйте позже",
      });
      return;
    }
    next();
  };
}

const MAX_BACKOFF_MS = 5 * 60 * 1000;

function backoffMs(failures: number): number {
  return Math.min(MAX_BACKOFF_MS, 1000 * 2 ** Math.max(0, failures - 1));
}

async function getFailureState(key: string): Promise<{
  consecutiveFailures: number;
  lockedUntil: number;
}> {
  const now = Date.now();

  if (usePostgres()) {
    try {
      const { eq } = await import("drizzle-orm");
      const { rateLimitFailuresTable } = await import("@workspace/db");
      const db = await getDb();
      const [row] = await db
        .select()
        .from(rateLimitFailuresTable)
        .where(eq(rateLimitFailuresTable.key, key));
      if (!row) return { consecutiveFailures: 0, lockedUntil: 0 };
      return {
        consecutiveFailures: row.consecutiveFailures,
        lockedUntil: row.lockedUntil ? new Date(row.lockedUntil).getTime() : 0,
      };
    } catch (err) {
      logger.warn({ err, key }, "Postgres failure limiter read failed");
    }
  }

  const row = memoryFailures.get(key);
  if (!row) return { consecutiveFailures: 0, lockedUntil: 0 };
  return {
    consecutiveFailures: row.consecutiveFailures,
    lockedUntil: row.lockedUntil,
  };
}

async function setFailureState(
  key: string,
  consecutiveFailures: number,
  lockedUntil: number,
): Promise<void> {
  const now = new Date();

  if (usePostgres()) {
    try {
      const { rateLimitFailuresTable } = await import("@workspace/db");
      const db = await getDb();
      await db
        .insert(rateLimitFailuresTable)
        .values({
          key,
          consecutiveFailures,
          lockedUntil: lockedUntil > 0 ? new Date(lockedUntil) : null,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: rateLimitFailuresTable.key,
          set: {
            consecutiveFailures,
            lockedUntil: lockedUntil > 0 ? new Date(lockedUntil) : null,
            updatedAt: now,
          },
        });
      return;
    } catch (err) {
      logger.warn({ err, key }, "Postgres failure limiter write failed");
    }
  }

  memoryFailures.set(key, {
    consecutiveFailures,
    lockedUntil,
    updatedAt: Date.now(),
  });
}

export async function recordFailedAttempt(
  scope: string,
  req: Request,
): Promise<{ blocked: boolean; retryAfterSec: number }> {
  const key = `${scope}:fail:${ipKey(req)}`;
  const now = Date.now();
  const state = await getFailureState(key);

  if (state.lockedUntil > now) {
    return {
      blocked: true,
      retryAfterSec: Math.ceil((state.lockedUntil - now) / 1000),
    };
  }

  const nextFailures = state.consecutiveFailures + 1;
  const lockedUntil =
    nextFailures >= 10 ? now + backoffMs(nextFailures) : 0;
  await setFailureState(key, nextFailures, lockedUntil);

  if (lockedUntil > now) {
    return {
      blocked: true,
      retryAfterSec: Math.ceil((lockedUntil - now) / 1000),
    };
  }
  return { blocked: false, retryAfterSec: 0 };
}

export async function clearFailedAttempts(
  scope: string,
  req: Request,
): Promise<void> {
  const key = `${scope}:fail:${ipKey(req)}`;
  await setFailureState(key, 0, 0);
}

export function failedAttemptGuard(scope: string): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { blocked, retryAfterSec } = await recordFailedAttempt(scope, req);
    if (blocked) {
      res.setHeader("Retry-After", String(Math.max(1, retryAfterSec)));
      res.status(429).json({ error: "Too many failed attempts" });
      return;
    }
    next();
  };
}

/**
 * Check-only: returns blocked state WITHOUT incrementing the failure counter.
 * Use with guardAndTrackFailures so the counter only moves on auth failures.
 */
async function checkFailedAttempts(
  scope: string,
  req: Request,
): Promise<{ blocked: boolean; retryAfterSec: number }> {
  const key = `${scope}:fail:${ipKey(req)}`;
  const now = Date.now();
  const state = await getFailureState(key);
  if (state.lockedUntil > now) {
    return {
      blocked: true,
      retryAfterSec: Math.ceil((state.lockedUntil - now) / 1000),
    };
  }
  return { blocked: false, retryAfterSec: 0 };
}

/**
 * Middleware that gates on the failure counter WITHOUT incrementing it on every
 * call. Instead it installs a response interceptor:
 *   - 401 / 404  → recordFailedAttempt (bad token, brute-force protection)
 *   - 2xx        → clearFailedAttempts  (good auth, reset streak)
 *
 * Use this instead of failedAttemptGuard on polling/read endpoints where
 * legitimate clients send many requests with a valid token. The old guard
 * incremented on *every* request, locking the IP after 10 polls.
 */
export function guardAndTrackFailures(scope: string): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only check — don't increment yet.
    const { blocked, retryAfterSec } = await checkFailedAttempts(scope, req);
    if (blocked) {
      res.setHeader("Retry-After", String(Math.max(1, retryAfterSec)));
      res.status(429).json({ error: "Too many failed attempts" });
      return;
    }

    // Wrap res.status + res.json to track outcome after the handler runs.
    const origStatus = res.status.bind(res);
    let statusCode = 200;
    res.status = ((code: number) => {
      statusCode = code;
      return origStatus(code);
    }) as typeof res.status;

    const origJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      if (statusCode === 401 || statusCode === 404) {
        void recordFailedAttempt(scope, req);
      } else if (statusCode >= 200 && statusCode < 300) {
        void clearFailedAttempts(scope, req);
      }
      return origJson(body);
    }) as typeof res.json;

    next();
  };
}

/** Wrap a handler: on 401/404 from invalid token, record failure. */
export function withTokenFailureTracking(
  scope: string,
  handler: RequestHandler,
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const origJson = res.json.bind(res);
    let statusCode = 200;
    const origStatus = res.status.bind(res);
    res.status = ((code: number) => {
      statusCode = code;
      return origStatus(code);
    }) as typeof res.status;

    res.json = ((body: unknown) => {
      if (statusCode === 401 || statusCode === 404) {
        void recordFailedAttempt(scope, req).then(({ blocked, retryAfterSec }) => {
          if (blocked) {
            res.setHeader("Retry-After", String(Math.max(1, retryAfterSec)));
          }
        });
      } else if (statusCode >= 200 && statusCode < 300) {
        void clearFailedAttempts(scope, req);
      }
      return origJson(body);
    }) as typeof res.json;

    handler(req, res, next);
  };
}

/** Remove stale rate-limit rows older than 24h. Call from worker/cron. */
export async function cleanupStaleRateLimits(): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (!usePostgres()) {
    for (const [k, v] of memoryBuckets) {
      if (v.updatedAt < cutoff.getTime()) memoryBuckets.delete(k);
    }
    for (const [k, v] of memoryFailures) {
      if (v.updatedAt < cutoff.getTime()) memoryFailures.delete(k);
    }
    return;
  }
  try {
    const { lt } = await import("drizzle-orm");
    const { rateLimitBucketsTable, rateLimitFailuresTable } = await import("@workspace/db");
    const db = await getDb();
    await db
      .delete(rateLimitBucketsTable)
      .where(lt(rateLimitBucketsTable.updatedAt, cutoff));
    await db
      .delete(rateLimitFailuresTable)
      .where(lt(rateLimitFailuresTable.updatedAt, cutoff));
  } catch (err) {
    logger.warn({ err }, "Rate limit cleanup failed");
  }
}

/** Periodic cleanup — call once at server startup. */
export function startRateLimitCleanup(): void {
  const intervalMs = 60 * 60 * 1000;
  setInterval(() => {
    void cleanupStaleRateLimits();
  }, intervalMs).unref();
}
