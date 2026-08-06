import { Router, type IRouter } from "express";
import { count } from "drizzle-orm";
import { HealthCheckResponse, HealthReadyResponse } from "@workspace/api-zod";
import { db, gamesTable, pool } from "@workspace/db";
import { getRedis } from "../lib/redis";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

type ReadinessCheck = {
  name: string;
  ok: boolean;
  hint?: string;
};

async function buildReadinessChecks(): Promise<ReadinessCheck[]> {
  const checks: ReadinessCheck[] = [];

  try {
    await pool.query("SELECT 1");
    checks.push({ name: "database", ok: true });
  } catch {
    checks.push({
      name: "database",
      ok: false,
      hint: "Запусти PostgreSQL или pnpm infra:up",
    });
  }

  const jwt = process.env["JWT_SECRET"]?.trim();
  checks.push({
    name: "jwt_secret",
    ok: Boolean(jwt),
    hint: jwt ? undefined : "Запусти pnpm setup — JWT_SECRET сгенерируется автоматически",
  });

  const walletKey = process.env["WALLET_ENCRYPTION_KEY"]?.trim();
  checks.push({
    name: "wallet_encryption_key",
    ok: Boolean(walletKey),
    hint: walletKey ? undefined : "Запусти pnpm setup",
  });

  if (process.env["REDIS_URL"]?.trim()) {
    const redis = getRedis();
    if (!redis) {
      checks.push({
        name: "redis",
        ok: false,
        hint: "Redis недоступен — pnpm infra:up или убери REDIS_URL",
      });
    } else {
      try {
        await redis.ping();
        checks.push({ name: "redis", ok: true });
      } catch {
        checks.push({
          name: "redis",
          ok: false,
          hint: "Redis не отвечает на ping",
        });
      }
    }
  }

  try {
    const [row] = await db.select({ n: count() }).from(gamesTable);
    const gamesCount = Number(row?.n ?? 0);
    checks.push({
      name: "games_catalog",
      ok: gamesCount > 0,
      hint:
        gamesCount > 0
          ? undefined
          : "Каталог пуст — перезапусти API (seedGames на старте)",
    });
  } catch {
    checks.push({
      name: "games_catalog",
      ok: false,
      hint: "Не удалось проверить каталог игр",
    });
  }

  return checks;
}

function isReady(checks: ReadinessCheck[]): boolean {
  return checks
    .filter((c) => c.name !== "redis")
    .every((c) => c.ok);
}

router.get("/healthz/ready", async (_req, res) => {
  const checks = await buildReadinessChecks();
  const ready = isReady(checks);
  const data = HealthReadyResponse.parse({ ready, checks });
  res.status(ready ? 200 : 503).json(data);
});

export default router;
