import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

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

const mockTrySetObjectEntityAclPolicy = vi.fn(async () => {});

vi.mock("@workspace/db", () => ({
  db: mockDb,
  hostsTable: { id: "id", hostToken: "hostToken" },
  playersTable: { id: "id", playerToken: "playerToken" },
}));

vi.mock("./objectStorage", () => ({
  ObjectStorageService: vi.fn(function () {
    return {
      trySetObjectEntityAclPolicy: mockTrySetObjectEntityAclPolicy,
    };
  }),
  ObjectNotFoundError: class ObjectNotFoundError extends Error {
    name = "ObjectNotFoundError";
  },
  ObjectStorageNotConfiguredError: class ObjectStorageNotConfiguredError extends Error {
    name = "ObjectStorageNotConfiguredError";
  },
}));

const {
  respondStorageUnavailable,
  handleStorageError,
  resolveHostIdFromRequest,
  resolvePlayerIdFromRequest,
  resolveCallerUserId,
  toObjectEntityPath,
  tryApplyObjectAcl,
} = await import("./storageRouteHelpers");

function mockRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res as Response & { statusCode: number; body: unknown };
}

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    log: {
      warn: vi.fn(),
      error: vi.fn(),
    },
    ...overrides,
  } as unknown as Request;
}

describe("storageRouteHelpers", () => {
  beforeEach(() => {
    queryQueue.length = 0;
    mockDb.select.mockClear();
    mockTrySetObjectEntityAclPolicy.mockClear();
  });

  describe("toObjectEntityPath", () => {
    it("normalizes API and object paths", () => {
      expect(toObjectEntityPath("/objects/uploads/abc")).toBe("/objects/uploads/abc");
      expect(toObjectEntityPath("/api/storage/objects/uploads/abc")).toBe(
        "/objects/uploads/abc",
      );
      expect(toObjectEntityPath("https://example.com/cover.jpg")).toBeNull();
      expect(toObjectEntityPath("")).toBeNull();
    });
  });

  describe("respondStorageUnavailable", () => {
    it("responds 503 with storage_unavailable", () => {
      const res = mockRes();
      respondStorageUnavailable(res);
      expect(res.statusCode).toBe(503);
      expect(res.body).toEqual({
        error: "storage_unavailable",
        message: "Хранилище объектов не настроено в этой среде",
      });
    });
  });

  describe("handleStorageError", () => {
    it("delegates to respondStorageUnavailable for ObjectStorageNotConfiguredError", async () => {
      const { ObjectStorageNotConfiguredError } = await import("./objectStorage");
      const req = mockReq();
      const res = mockRes();
      handleStorageError(req, res, new ObjectStorageNotConfiguredError(), "fallback");
      expect(res.statusCode).toBe(503);
      expect(res.body).toMatchObject({ error: "storage_unavailable" });
    });

    it("returns 404 for ObjectNotFoundError", async () => {
      const { ObjectNotFoundError } = await import("./objectStorage");
      const req = mockReq();
      const res = mockRes();
      handleStorageError(req, res, new ObjectNotFoundError(), "fallback");
      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ error: "Object not found" });
      expect(req.log.warn).toHaveBeenCalled();
    });

    it("returns 500 for other errors", () => {
      const req = mockReq();
      const res = mockRes();
      handleStorageError(req, res, new Error("boom"), "Server error");
      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: "Server error" });
      expect(req.log.error).toHaveBeenCalled();
    });
  });

  describe("resolveHostIdFromRequest", () => {
    it("returns null without host token", async () => {
      expect(await resolveHostIdFromRequest(mockReq())).toBeNull();
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it("returns host id when token matches", async () => {
      queueResults([{ id: "host-42" }]);
      const req = mockReq({ headers: { authorization: "Bearer host-tok" } });
      expect(await resolveHostIdFromRequest(req)).toBe("host-42");
      expect(mockDb.select).toHaveBeenCalled();
    });

    it("returns null when host is not found", async () => {
      queueResults([]);
      const req = mockReq({ headers: { authorization: "Bearer unknown" } });
      expect(await resolveHostIdFromRequest(req)).toBeNull();
    });
  });

  describe("resolvePlayerIdFromRequest", () => {
    it("returns null without player token", async () => {
      expect(await resolvePlayerIdFromRequest(mockReq())).toBeNull();
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it("reads x-player-token header", async () => {
      queueResults([{ id: "player-7" }]);
      const req = mockReq({ headers: { "x-player-token": "ptok" } });
      expect(await resolvePlayerIdFromRequest(req)).toBe("player-7");
    });

    it("prefers x-player-wallet-token over x-player-token", async () => {
      queueResults([{ id: "player-w" }]);
      const req = mockReq({
        headers: {
          "x-player-wallet-token": "wallet-tok",
          "x-player-token": "legacy",
        },
      });
      expect(await resolvePlayerIdFromRequest(req)).toBe("player-w");
    });
  });

  describe("resolveCallerUserId", () => {
    it("returns host: prefix when host resolves", async () => {
      queueResults([{ id: "h1" }]);
      const req = mockReq({ headers: { authorization: "Bearer host-tok" } });
      expect(await resolveCallerUserId(req)).toBe("host:h1");
    });

    it("falls back to player: prefix", async () => {
      queueResults([{ id: "p2" }]);
      const req = mockReq({ headers: { "x-player-token": "ptok" } });
      expect(await resolveCallerUserId(req)).toBe("player:p2");
    });

    it("returns undefined when neither resolves", async () => {
      expect(await resolveCallerUserId(mockReq())).toBeUndefined();
    });
  });

  describe("tryApplyObjectAcl", () => {
    it("no-ops for invalid paths", async () => {
      await tryApplyObjectAcl("https://example.com/x", {
        owner: "host:1",
        visibility: "public",
      });
      expect(mockTrySetObjectEntityAclPolicy).not.toHaveBeenCalled();
    });

    it("applies ACL for /objects/ path", async () => {
      const policy = { owner: "host:1", visibility: "public" as const };
      await tryApplyObjectAcl("/objects/uploads/cover.png", policy);
      expect(mockTrySetObjectEntityAclPolicy).toHaveBeenCalledWith(
        "/objects/uploads/cover.png",
        policy,
      );
    });

    it("normalizes /api/storage/objects/ paths before ACL write", async () => {
      const policy = { owner: "host:1", visibility: "private" as const };
      await tryApplyObjectAcl("/api/storage/objects/uploads/cover.png", policy);
      expect(mockTrySetObjectEntityAclPolicy).toHaveBeenCalledWith(
        "/objects/uploads/cover.png",
        policy,
      );
    });

    it("swallows storage errors and logs warning", async () => {
      mockTrySetObjectEntityAclPolicy.mockRejectedValueOnce(new Error("acl fail"));
      const req = mockReq();
      await tryApplyObjectAcl(
        "/objects/x",
        { owner: "host:1", visibility: "private" },
        req,
      );
      expect(req.log.warn).toHaveBeenCalled();
    });
  });
});
