// Redis client with graceful fallback when REDIS_URL is unset or unreachable.
// Used for rate-limiting, signaling pub/sub, token storage, and catalog cache.

import { logger } from "./logger";

type RedisClient = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: string, ttl?: number): Promise<unknown>;
  setex(key: string, ttlSec: number, value: string): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
  incr(key: string): Promise<number>;
  expire(key: string, ttlSec: number): Promise<number>;
  publish(channel: string, message: string): Promise<number>;
  duplicate(): RedisClient;
  subscribe(channel: string): Promise<number>;
  on(event: string, listener: (...args: unknown[]) => void): void;
  ping(): Promise<string>;
  quit(): Promise<string>;
};

let client: RedisClient | null = null;
let subscriber: RedisClient | null = null;
let available = false;

export function isRedisAvailable(): boolean {
  return available;
}

export async function initRedis(): Promise<boolean> {
  const url = process.env["REDIS_URL"]?.trim();
  if (!url) {
    logger.info("REDIS_URL not set — using PG/memory fallbacks");
    return false;
  }

  try {
    const { default: Redis } = await import("ioredis");
    client = new Redis(url, {
      maxRetriesPerRequest: 2,
      lazyConnect: true,
      enableOfflineQueue: false,
    }) as unknown as RedisClient;
    await client.ping();
    subscriber = client.duplicate();
    await subscriber.ping();
    available = true;
    logger.info("Redis connected");
    return true;
  } catch (err) {
    logger.warn({ err }, "Redis unavailable — using PG/memory fallbacks");
    client = null;
    subscriber = null;
    available = false;
    return false;
  }
}

export function getRedis(): RedisClient | null {
  return available ? client : null;
}

export function getRedisSubscriber(): RedisClient | null {
  return available ? subscriber : null;
}

export async function redisHealthCheck(): Promise<{ ok: boolean; reason?: string }> {
  if (!client) return { ok: false, reason: "not configured" };
  try {
    const pong = await client.ping();
    return { ok: pong === "PONG" };
  } catch (err) {
    return { ok: false, reason: String(err) };
  }
}

export async function shutdownRedis(): Promise<void> {
  try {
    await subscriber?.quit();
    await client?.quit();
  } catch {
    /* noop */
  }
  client = null;
  subscriber = null;
  available = false;
}
