import { createServer } from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { attachSignaling } from "./lib/signaling";
import { startBillingWorker } from "./lib/billingWorker";
import { startDepositWorker } from "./lib/depositWorker";
import { seedGames } from "./lib/seedGames";

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

server.listen(port, () => {
  logger.info({ port }, "Server listening");
  startBillingWorker();
  startDepositWorker();
  seedGames().catch((err) => {
    logger.error({ err }, "Failed to seed games catalog");
  });
});

server.on("error", (err) => {
  logger.error({ err }, "HTTP server error");
  process.exit(1);
});
