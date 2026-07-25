import { Router, type IRouter, type Request, type Response } from "express";
import { subscribePlatformEvents, type PlatformEvent } from "../lib/pgNotify";

const router: IRouter = Router();

/**
 * GET /events/stream — Server-Sent Events fan-out for Postgres NOTIFY payloads.
 * Clients reconnect automatically; used instead of aggressive polling.
 */
router.get("/events/stream", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = (event: PlatformEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  send({ type: "connected", payload: {}, at: new Date().toISOString() });

  const unsubscribe = subscribePlatformEvents(send);

  const keepAlive = setInterval(() => {
    res.write(": keepalive\n\n");
  }, 25_000);

  req.on("close", () => {
    clearInterval(keepAlive);
    unsubscribe();
  });
});

export default router;
