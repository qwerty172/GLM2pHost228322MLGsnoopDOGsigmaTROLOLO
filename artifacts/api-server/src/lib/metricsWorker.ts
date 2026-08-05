// Aggregates session_metrics into sessions.qualityScore / avgRttMs / avgLossPct.

import { eq, sql, lt, gt } from "drizzle-orm";
import { db, sessionMetricsTable, sessionsTable } from "@workspace/db";
import { logger } from "./logger";

const AGGREGATE_MS = 30_000;
/** Rolling window for quality averages — avoids full-table scans as metrics age. */
const AGGREGATION_WINDOW_MS = 60 * 60 * 1000;
const METRICS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

let isAggregating = false;

/** Pure score helper — exported for unit tests. */
export function computeQualityScore(
  rtt: number,
  loss: number,
  bitrate: number,
): number {
  let score = 100;
  score -= Math.min(50, loss * 5);
  score -= Math.min(30, Math.max(0, rtt - 50) / 10);
  if (bitrate < 2000) score -= 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}

async function aggregateSessionMetrics(): Promise<void> {
  if (isAggregating) return;
  isAggregating = true;
  try {
    const windowStart = new Date(Date.now() - AGGREGATION_WINDOW_MS);
    const rows = await db
      .select({
        sessionId: sessionMetricsTable.sessionId,
        avgRtt: sql<number>`coalesce(avg(${sessionMetricsTable.rttMs}), 0)::int`,
        avgLoss: sql<number>`coalesce(avg(${sessionMetricsTable.packetLossPct}), 0)::int`,
        avgBitrate: sql<number>`coalesce(avg(${sessionMetricsTable.bitrateKbps}), 0)::int`,
      })
      .from(sessionMetricsTable)
      .where(gt(sessionMetricsTable.sampledAt, windowStart))
      .groupBy(sessionMetricsTable.sessionId);

    for (const row of rows) {
      const loss = Number(row.avgLoss) || 0;
      const rtt = Number(row.avgRtt) || 0;
      const bitrate = Number(row.avgBitrate) || 0;
      const score = computeQualityScore(rtt, loss, bitrate);

      await db
        .update(sessionsTable)
        .set({
          qualityScore: score,
          avgRttMs: rtt,
          avgLossPct: loss,
        })
        .where(eq(sessionsTable.id, row.sessionId));
    }
  } finally {
    isAggregating = false;
  }
}

async function cleanupOldMetrics(): Promise<void> {
  const cutoff = new Date(Date.now() - METRICS_TTL_MS);
  await db
    .delete(sessionMetricsTable)
    .where(lt(sessionMetricsTable.sampledAt, cutoff));
}

export function startMetricsWorker(): void {
  setInterval(() => {
    void aggregateSessionMetrics().catch((err) => {
      logger.error({ err }, "Metrics aggregation failed");
    });
  }, AGGREGATE_MS).unref();

  setInterval(() => {
    void cleanupOldMetrics().catch((err) => {
      logger.error({ err }, "Metrics cleanup failed");
    });
  }, 60 * 60 * 1000).unref();
}
