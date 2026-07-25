import { pool } from "@workspace/db";
import { logger } from "./logger";

export const NOTIFY_CHANNEL = "decentralhub_events";

export type PlatformEvent = {
  type: string;
  payload: Record<string, unknown>;
  at: string;
};

type Listener = (event: PlatformEvent) => void;

type PgPoolClient = {
  query: (text: string) => Promise<unknown>;
  release: () => void;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
};

const listeners = new Set<Listener>();
let listenClient: PgPoolClient | null = null;

export async function startPgNotifyListener(): Promise<void> {
  if (listenClient || !process.env.DATABASE_URL) return;

  const client = (await pool.connect()) as PgPoolClient;
  listenClient = client;
  client.on("notification", (msg: unknown) => {
    const payload = (msg as { payload?: string }).payload;
    if (!payload) return;
    try {
      const event = JSON.parse(payload) as PlatformEvent;
      for (const fn of listeners) fn(event);
    } catch (err) {
      logger.warn({ err }, "Failed to parse NOTIFY payload");
    }
  });
  client.on("error", (err: unknown) => {
    logger.error({ err }, "pg LISTEN client error");
  });

  await client.query(`LISTEN ${NOTIFY_CHANNEL}`);
  logger.info({ channel: NOTIFY_CHANNEL }, "Postgres LISTEN active");
}

export function subscribePlatformEvents(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function emitPlatformEvent(
  type: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const event: PlatformEvent = {
    type,
    payload,
    at: new Date().toISOString(),
  };
  try {
    await pool.query(`SELECT pg_notify($1, $2)`, [
      NOTIFY_CHANNEL,
      JSON.stringify(event),
    ]);
  } catch (err) {
    logger.warn({ err, type }, "pg_notify failed — fan-out locally only");
  }
  for (const fn of listeners) fn(event);
}

export async function stopPgNotifyListener(): Promise<void> {
  if (!listenClient) return;
  try {
    await listenClient.query(`UNLISTEN ${NOTIFY_CHANNEL}`);
    listenClient.release();
  } catch {
    /* ignore */
  }
  listenClient = null;
}
