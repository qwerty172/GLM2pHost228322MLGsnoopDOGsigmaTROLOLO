import { Router, type IRouter, type Request, type Response } from "express";
import { subscribePlatformEvents, type PlatformEvent } from "../lib/pgNotify";
import { requireHost } from "../lib/hostAuth";
import { rateLimit, ipKey } from "../lib/rateLimit";
import { filterEventForHost } from "../lib/eventStreamFilter";

const router: IRouter = Router();

const streamLimiter = rateLimit({
  scope: "events_stream",
  windowMs: 60_000,
  max: 30,
  keyFn: ipKey,
});

/**
 * GET /events/stream — Server-Sent Events fan-out for Postgres NOTIFY payloads.
 * Requires host auth (Authorization / X-Host-Token / X-User-Token).
 */
router.get("/events/stream", streamLimiter, async (req: Request, res: Response) => {
  const auth = await requireHost(req);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  const hostId = auth.host.id;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = (event: PlatformEvent) => {
    const filtered = filterEventForHost(event, hostId);
    if (!filtered) return;
    res.write(`data: ${JSON.stringify(filtered)}\n\n`);
  };

  send({ type: "connected", payload: { hostId }, at: new Date().toISOString() });

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
