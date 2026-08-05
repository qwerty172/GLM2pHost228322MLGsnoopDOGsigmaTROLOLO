import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";
process.env.RATE_LIMIT_STORAGE = "memory";
process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL ??=
  "https://test.anthropic.example";
process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ??= "test-api-key";

const OWNER_TOKEN = "owner-token";
const HOST_ID = "host-1";

const mockResolveOwnerByToken = vi.fn<
  (token: string) => Promise<{ id: string; type: "host" | "player" } | null>
>();

const { mockMessagesCreate } = vi.hoisted(() => ({
  mockMessagesCreate: vi.fn(),
}));

vi.mock("../lib/rateLimit", () => ({
  rateLimit: () =>
    (_req: unknown, _res: unknown, next: () => void) => {
      next();
    },
  ipKey: () => "test-ip",
}));

vi.mock("../lib/walletOwner", () => ({
  resolveOwnerByToken: (token: string) => mockResolveOwnerByToken(token),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = {
      create: mockMessagesCreate,
    };
  },
}));

const { default: quotaAiChatRouter } = await import("./quotaAiChat");

let baseUrl = "";
let server: Server;

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    ownerToken: OWNER_TOKEN,
    messages: [{ role: "user" as const, content: "Сделай спонсорскую квоту" }],
    currentFormState: { kind: "royalty", title: "" },
    ...overrides,
  };
}

async function request(
  method: string,
  path: string,
  opts: { body?: unknown } = {},
) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: unknown = undefined;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
  }
  return { status: res.status, json };
}

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(quotaAiChatRouter);
  await new Promise<void>((resolve) => {
    server = createServer(app).listen(0, "127.0.0.1", () => {
      const addr = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /quotas/ai-chat", () => {
  it("returns 400 when messages are missing", async () => {
    const res = await request("POST", "/quotas/ai-chat", {
      body: { ownerToken: OWNER_TOKEN, currentFormState: {} },
    });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ error: expect.any(String) });
  });

  it("returns 400 when messages array is empty", async () => {
    const res = await request("POST", "/quotas/ai-chat", {
      body: validBody({ messages: [] }),
    });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ error: expect.any(String) });
  });

  it("returns 401 when owner token is invalid", async () => {
    mockResolveOwnerByToken.mockResolvedValue(null);
    const res = await request("POST", "/quotas/ai-chat", {
      body: validBody(),
    });
    expect(res.status).toBe(401);
    expect(res.json).toMatchObject({ error: "Invalid owner token" });
  });

  it("returns AI reply with sanitized form patch from tool_use", async () => {
    mockResolveOwnerByToken.mockResolvedValue({ id: HOST_ID, type: "host" });
    mockMessagesCreate.mockResolvedValue({
      content: [
        { type: "text", text: "Заполнил: kind, title." },
        {
          type: "tool_use",
          name: "update_form_fields",
          input: {
            kind: "sponsor",
            title: "Спонсор",
            budgetLzt: 1000,
            evilField: "x",
          },
        },
      ],
    });
    const res = await request("POST", "/quotas/ai-chat", {
      body: validBody({
        availableGames: [{ id: "g1", title: "Dota 2" }],
      }),
    });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({
      reply: "Заполнил: kind, title.",
      formPatch: { kind: "sponsor", title: "Спонсор", budgetLzt: 1000 },
    });
    expect(
      (res.json as { formPatch: Record<string, unknown> }).formPatch,
    ).not.toHaveProperty("evilField");
    expect(mockMessagesCreate).toHaveBeenCalledOnce();
  });

  it("generates default reply when AI returns only tool_use", async () => {
    mockResolveOwnerByToken.mockResolvedValue({ id: HOST_ID, type: "host" });
    mockMessagesCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          name: "update_form_fields",
          input: { kind: "royalty", title: "Роялти" },
        },
      ],
    });
    const res = await request("POST", "/quotas/ai-chat", {
      body: validBody(),
    });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({
      reply: "Заполнил: kind, title. Что-то поменять?",
      formPatch: { kind: "royalty", title: "Роялти" },
    });
  });

  it("returns fallback reply when AI returns empty content", async () => {
    mockResolveOwnerByToken.mockResolvedValue({ id: HOST_ID, type: "host" });
    mockMessagesCreate.mockResolvedValue({ content: [] });
    const res = await request("POST", "/quotas/ai-chat", {
      body: validBody(),
    });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ reply: "Готово! Что-то поменять?" });
  });

  it("returns 500 when Anthropic API fails", async () => {
    mockResolveOwnerByToken.mockResolvedValue({ id: HOST_ID, type: "host" });
    mockMessagesCreate.mockRejectedValue(new Error("upstream error"));
    const res = await request("POST", "/quotas/ai-chat", {
      body: validBody(),
    });
    expect(res.status).toBe(500);
    expect(res.json).toMatchObject({ error: "upstream error" });
  });
});
