import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, hostsTable, sessionsTable } from "@workspace/db";
import {
  RegisterHostBody,
  GetHostResponse,
  GetHostParams,
  ListHostSessionsParams,
  ListHostSessionsResponseItem,
} from "@workspace/api-zod";
import { generateToken } from "../lib/tokens";

const router: IRouter = Router();

router.post("/hosts/register", async (req, res): Promise<void> => {
  const parsed = RegisterHostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const hostToken = generateToken();
  const [host] = await db
    .insert(hostsTable)
    .values({
      hostToken,
      displayName: parsed.data.displayName,
    })
    .returning();

  if (!host) {
    res.status(500).json({ error: "Failed to create host" });
    return;
  }

  req.log.info({ hostId: host.id }, "Host registered");
  res.status(201).json(GetHostResponse.parse(host));
});

router.get("/hosts/:hostToken", async (req, res): Promise<void> => {
  const params = GetHostParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [host] = await db
    .select()
    .from(hostsTable)
    .where(eq(hostsTable.hostToken, params.data.hostToken));

  if (!host) {
    res.status(404).json({ error: "Host not found" });
    return;
  }

  res.json(GetHostResponse.parse(host));
});

router.get("/hosts/:hostToken/sessions", async (req, res): Promise<void> => {
  const params = ListHostSessionsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [host] = await db
    .select()
    .from(hostsTable)
    .where(eq(hostsTable.hostToken, params.data.hostToken));

  if (!host) {
    res.status(404).json({ error: "Host not found" });
    return;
  }

  const sessions = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.hostId, host.id))
    .orderBy(desc(sessionsTable.createdAt));

  res.json(sessions.map((s) => ListHostSessionsResponseItem.parse(s)));
});

export default router;
