import { createServer } from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { attachSignaling, closeSignaling } from "./lib/signaling";
import { startBillingWorker, stopBillingWorker } from "./lib/billingWorker";
import { startDepositWorker, stopDepositWorker } from "./lib/depositWorker";
import { startQuotaExpiryWorker, stopQuotaExpiryWorker } from "./lib/quotaExpiryWorker";
import { startInterestWorker, stopInterestWorker } from "./lib/interestWorker";
import { startLoanDefaultWorker, stopLoanDefaultWorker } from "./lib/loanDefaultWorker";
import { startHostHealthWorker, stopHostHealthWorker } from "./lib/hostHealthWorker";
import { startScheduleWatchdog, stopScheduleWatchdog } from "./lib/scheduleWatchdog";
import { startVdsProvisionWorker, stopVdsProvisionWorker } from "./lib/vdsProvisionWorker";
import { startRateLimitCleanup } from "./lib/rateLimit";
import { initRedis } from "./lib/redis";
import { startOutboxWorker } from "./lib/outboxWorker";
import { startMetricsWorker } from "./lib/metricsWorker";
import { seedGames } from "./lib/seedGames";
import { runLegacyBackfill } from "./lib/legacyBackfill";
import { runStorageAclBackfill } from "./lib/storageAcl";
import { startPgNotifyListener, stopPgNotifyListener, emitPlatformEvent } from "./lib/pgNotify";
import { initSentry } from "./lib/sentry";
import { pool } from "@workspace/db";

export { emitPlatformEvent };

void initSentry();

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = createServer(app);
attachSignaling(server);

void startPgNotifyListener().catch((err) => {
  logger.warn({ err }, "Postgres LISTEN unavailable — SSE will use in-process fan-out only");
});

function startWorkers() {
  startBillingWorker();
  startDepositWorker();
  startQuotaExpiryWorker();
  startInterestWorker();
  startLoanDefaultWorker();
  startHostHealthWorker();
  startScheduleWatchdog();
  startVdsProvisionWorker();
  startRateLimitCleanup();
  startOutboxWorker();
  startMetricsWorker();
  seedGames().catch((err) => {
    logger.error({ err }, "Failed to seed games catalog");
  });
  runLegacyBackfill().catch((err) => {
    logger.error({ err }, "Failed to run legacy backfill");
  });
  runStorageAclBackfill().catch((err) => {
    logger.error({ err }, "Failed to run storage ACL backfill");
  });
}

function stopWorkers() {
  stopBillingWorker();
  stopDepositWorker();
  stopQuotaExpiryWorker();
  stopInterestWorker();
  stopLoanDefaultWorker();
  stopHostHealthWorker();
  stopScheduleWatchdog();
  stopVdsProvisionWorker();
}

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 2_000;
let listenAttempt = 0;
let shuttingDown = false;

async function boot(): Promise<void> {
  await initRedis();
  listen();
}

function listen(): void {
  listenAttempt += 1;
  server.listen(port, () => {
    logger.info({ port }, "Server listening");
    startWorkers();
  });
}

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE" && !server.listening) {
    if (listenAttempt < MAX_RETRIES) {
      logger.warn(
        { port, attempt: listenAttempt, maxRetries: MAX_RETRIES },
        `Port ${port} in use — retrying in ${RETRY_DELAY_MS}ms (attempt ${listenAttempt}/${MAX_RETRIES})`,
      );
      setTimeout(() => {
        server.close();
        listen();
      }, RETRY_DELAY_MS);
      return;
    }
    logger.error(
      { port, attempts: listenAttempt },
      `Port ${port} still in use after ${MAX_RETRIES} retries — giving up`,
    );
  } else {
    logger.error({ err }, "HTTP server error");
  }
  process.exit(1);
});

function gracefulShutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Received shutdown signal — stopping workers and closing server");

  stopWorkers();
  closeSignaling(server);
  void stopPgNotifyListener();

  server.close((closeErr) => {
    if (closeErr) {
      logger.error({ err: closeErr }, "Error closing HTTP server");
    } else {
      logger.info("HTTP server closed cleanly");
    }
    void pool
      .end()
      .then(() => {
        logger.info("Database pool closed");
        process.exit(closeErr ? 1 : 0);
      })
      .catch((poolErr) => {
        logger.error({ err: poolErr }, "Error closing database pool");
        process.exit(1);
      });
  });

  setTimeout(() => {
    logger.warn("Graceful shutdown timed out — forcing exit");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

void boot();
