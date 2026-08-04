import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

/** Готовность к работе: API + доступ к PostgreSQL. Для setup/quickstart. */
router.get("/readyz", async (_req, res) => {
  try {
    await db.execute(sql`SELECT 1`);
    res.json({ status: "ok", database: "connected" });
  } catch (err) {
    res.status(503).json({
      status: "unavailable",
      database: "disconnected",
      error: err instanceof Error ? err.message : "unknown",
    });
  }
});

export default router;
