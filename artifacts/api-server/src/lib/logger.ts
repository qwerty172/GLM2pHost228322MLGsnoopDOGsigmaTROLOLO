import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers['x-host-token']",
      "req.headers['x-user-token']",
      "req.headers['x-player-token']",
      "req.headers['x-player-wallet-token']",
      "req.headers['x-admin-secret']",
      "req.headers['x-dev-key-secret']",
      "req.headers['x-token']",
      "res.headers['set-cookie']",
      // Query / body fields that commonly carry secrets
      "hostToken",
      "playerToken",
      "playerWalletToken",
      "apiKey",
      "streamKey",
      "*.hostToken",
      "*.playerToken",
      "*.playerWalletToken",
      "*.apiKey",
      "*.streamKey",
    ],
    censor: "[Redacted]",
  },
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
