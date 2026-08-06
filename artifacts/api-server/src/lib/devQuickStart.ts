import { logger } from "./logger";

const WEB_PORT = process.env.WEB_PORT ?? "5000";
const API_PORT = process.env.PORT ?? "8080";

/** Печатает подсказки для локальной разработки — один раз при старте API. */
export function logDevQuickStart(): void {
  if (process.env.NODE_ENV === "production") return;

  const web = `http://localhost:${WEB_PORT}`;
  const api = `http://localhost:${API_PORT}`;

  const lines = [
    "",
    "┌─ DecentralHub — локально готово ─────────────────────────────",
    `│  Web:     ${web}`,
    `│  API:     ${api}/api/healthz`,
    `│  Демо:    ${web}/games/rogue-fable-3  (без Windows-агента)`,
    `│  Хост:    ${web}/host`,
    "│",
    "│  Позже: TURN, object storage, coturn — см. .env.example",
    "└────────────────────────────────────────────────────────────",
    "",
  ];

  logger.info(lines.join("\n"));
}
