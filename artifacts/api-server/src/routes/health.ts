import { Router, type IRouter } from "express";
import { HealthCheckResponse, ReadinessCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/readyz", async (_req, res) => {
  const checks: Record<string, string> = {};
  let ok = true;

  try {
    await pool.query("SELECT 1");
    checks.database = "ok";
  } catch (err) {
    ok = false;
    checks.database = err instanceof Error ? err.message : "unreachable";
  }

  const data = ReadinessCheckResponse.parse({
    status: ok ? "ok" : "degraded",
    checks,
  });
  res.status(ok ? 200 : 503).json(data);
});

export default router;
