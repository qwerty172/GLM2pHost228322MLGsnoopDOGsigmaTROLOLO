import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Request } from "express";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";

const queryQueue: unknown[][] = [];

function queueResults(...batches: unknown[][]) {
  queryQueue.push(...batches);
}

function nextResult(): unknown[] {
  return queryQueue.shift() ?? [];
}

const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(async () => nextResult()),
    })),
  })),
};

vi.mock("@workspace/db", () => ({
  db: mockDb,
  hostsTable: { id: "id", hostToken: "hostToken" },
}));

const { hostTokenFromRequest, requireHost } = await import("./hostAuth");

describe("hostAuth", () => {
  beforeEach(() => {
    queryQueue.length = 0;
    mockDb.select.mockClear();
  });

  it("re-exports hostTokenFromRequest", () => {
    const req = { headers: { authorization: "Bearer host-abc" } } as Request;
    expect(hostTokenFromRequest(req)).toBe("host-abc");
  });

  it("requireHost returns 401 when no host token", async () => {
    const req = { headers: {} } as Request;
    await expect(requireHost(req)).resolves.toEqual({
      ok: false,
      status: 401,
      error: "hostToken required in Authorization or X-Host-Token",
    });
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("requireHost returns 404 when host not found", async () => {
    queueResults([]);
    const req = { headers: { authorization: "Bearer unknown-token" } } as Request;
    await expect(requireHost(req)).resolves.toEqual({
      ok: false,
      status: 404,
      error: "Host not found",
    });
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("requireHost returns host when token matches", async () => {
    const host = { id: "host-1", hostToken: "valid-token", displayName: "Test Host" };
    queueResults([host]);
    const req = { headers: { authorization: "Bearer valid-token" } } as Request;
    await expect(requireHost(req)).resolves.toEqual({ ok: true, host });
    expect(mockDb.select).toHaveBeenCalled();
  });
});
