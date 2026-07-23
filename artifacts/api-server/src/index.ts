import { createServer } from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { attachSignaling } from "./lib/signaling";
import { startBillingWorker } from "./lib/billingWorker";
import { startDepositWorker } from "./lib/depositWorker";
import { startQuotaExpiryWorker } from "./lib/quotaExpiryWorker";
import { startInterestWorker } from "./lib/interestWorker";
import { startLoanDefaultWorker } from "./lib/loanDefaultWorker";
import { startHostHealthWorker } from "./lib/hostHealthWorker";
import { startScheduleWatchdog } from "./lib/scheduleWatchdog";
import { startVdsProvisionWorker } from "./lib/vdsProvisionWorker";
import { startRateLimitCleanup } from "./lib/rateLimit";
import { seedGames } from "./lib/seedGames";
import { runLegacyBackfill } from "./lib/legacyBackfill";

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
  seedGames().catch((err) => {
    logger.error({ err }, "Failed to seed games catalog");
  });
  runLegacyBackfill().catch((err) => {
    logger.error({ err }, "Failed to run legacy backfill");
  });
}

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 2_000;
let listenAttempt = 0;

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
  logger.info({ signal }, "Received shutdown signal — closing HTTP server");
  server.close((closeErr) => {
    if (closeErr) {
      logger.error({ err: closeErr }, "Error closing HTTP server");
      process.exit(1);
    }
    logger.info("HTTP server closed cleanly");
    process.exit(0);
  });
  setTimeout(() => {
    logger.warn("Graceful shutdown timed out — forcing exit");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

listen();
