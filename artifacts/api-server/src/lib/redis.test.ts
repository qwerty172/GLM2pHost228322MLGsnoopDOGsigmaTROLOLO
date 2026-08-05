import { describe, expect, it, vi, beforeEach } from "vitest";

const {
  mockPing,
  mockQuit,
  mockDuplicatePing,
  mockDuplicateQuit,
  mockSubscriber,
  mockClient,
  RedisMock,
} = vi.hoisted(() => {
  const mockPing = vi.fn(async () => "PONG");
  const mockQuit = vi.fn(async () => "OK");
  const mockDuplicatePing = vi.fn(async () => "PONG");
  const mockDuplicateQuit = vi.fn(async () => "OK");

  const mockSubscriber = {
    ping: mockDuplicatePing,
    quit: mockDuplicateQuit,
    subscribe: vi.fn(),
    on: vi.fn(),
  };

  const mockClient = {
    ping: mockPing,
    quit: mockQuit,
    duplicate: vi.fn(() => mockSubscriber),
    get: vi.fn(),
    set: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
    publish: vi.fn(),
  };

  const RedisMock = vi.fn(function RedisMock() {
    return mockClient;
  });

  return {
    mockPing,
    mockQuit,
    mockDuplicatePing,
    mockDuplicateQuit,
    mockSubscriber,
    mockClient,
    RedisMock,
  };
});

vi.mock("ioredis", () => ({
  default: RedisMock,
}));

async function loadRedis() {
  vi.resetModules();
  return import("./redis");
}

describe("redis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.REDIS_URL;
    mockPing.mockResolvedValue("PONG");
    mockDuplicatePing.mockResolvedValue("PONG");
  });

  it("reports unavailable before init", async () => {
    const { isRedisAvailable } = await loadRedis();
    expect(isRedisAvailable()).toBe(false);
  });

  describe("initRedis", () => {
    it("returns false when REDIS_URL is unset", async () => {
      const { initRedis, isRedisAvailable } = await loadRedis();
      expect(await initRedis()).toBe(false);
      expect(isRedisAvailable()).toBe(false);
      expect(RedisMock).not.toHaveBeenCalled();
    });

    it("connects client and subscriber when REDIS_URL is set", async () => {
      process.env.REDIS_URL = "redis://127.0.0.1:6379";
      const { initRedis, isRedisAvailable } = await loadRedis();
      expect(await initRedis()).toBe(true);
      expect(isRedisAvailable()).toBe(true);
      expect(RedisMock).toHaveBeenCalledWith("redis://127.0.0.1:6379", {
        maxRetriesPerRequest: 2,
        lazyConnect: true,
        enableOfflineQueue: false,
      });
      expect(mockPing).toHaveBeenCalled();
      expect(mockClient.duplicate).toHaveBeenCalled();
      expect(mockDuplicatePing).toHaveBeenCalled();
    });

    it("returns false when connection fails", async () => {
      process.env.REDIS_URL = "redis://127.0.0.1:6379";
      mockPing.mockRejectedValueOnce(new Error("connection refused"));
      const { initRedis, isRedisAvailable } = await loadRedis();
      expect(await initRedis()).toBe(false);
      expect(isRedisAvailable()).toBe(false);
    });
  });

  describe("getRedis", () => {
    it("returns null before init", async () => {
      const { getRedis } = await loadRedis();
      expect(getRedis()).toBeNull();
    });

    it("returns client after successful init", async () => {
      process.env.REDIS_URL = "redis://127.0.0.1:6379";
      const { initRedis, getRedis } = await loadRedis();
      await initRedis();
      expect(getRedis()).toBe(mockClient);
    });
  });

  describe("getRedisSubscriber", () => {
    it("returns null before init", async () => {
      const { getRedisSubscriber } = await loadRedis();
      expect(getRedisSubscriber()).toBeNull();
    });

    it("returns subscriber after successful init", async () => {
      process.env.REDIS_URL = "redis://127.0.0.1:6379";
      const { initRedis, getRedisSubscriber } = await loadRedis();
      await initRedis();
      expect(getRedisSubscriber()).toBe(mockSubscriber);
    });
  });

  describe("redisHealthCheck", () => {
    it("reports not configured when client is absent", async () => {
      const { redisHealthCheck } = await loadRedis();
      await expect(redisHealthCheck()).resolves.toEqual({
        ok: false,
        reason: "not configured",
      });
    });

    it("reports ok on PONG", async () => {
      process.env.REDIS_URL = "redis://127.0.0.1:6379";
      const { initRedis, redisHealthCheck } = await loadRedis();
      await initRedis();
      await expect(redisHealthCheck()).resolves.toEqual({ ok: true });
    });

    it("reports failure when ping throws", async () => {
      process.env.REDIS_URL = "redis://127.0.0.1:6379";
      const { initRedis, redisHealthCheck } = await loadRedis();
      await initRedis();
      mockPing.mockRejectedValueOnce(new Error("timeout"));
      await expect(redisHealthCheck()).resolves.toEqual({
        ok: false,
        reason: "Error: timeout",
      });
    });
  });

  describe("shutdownRedis", () => {
    it("quits client and subscriber and clears availability", async () => {
      process.env.REDIS_URL = "redis://127.0.0.1:6379";
      const { initRedis, shutdownRedis, isRedisAvailable, getRedis } = await loadRedis();
      await initRedis();
      await shutdownRedis();
      expect(mockDuplicateQuit).toHaveBeenCalled();
      expect(mockQuit).toHaveBeenCalled();
      expect(isRedisAvailable()).toBe(false);
      expect(getRedis()).toBeNull();
    });

    it("is safe when redis was never initialized", async () => {
      const { shutdownRedis, isRedisAvailable } = await loadRedis();
      await expect(shutdownRedis()).resolves.toBeUndefined();
      expect(isRedisAvailable()).toBe(false);
      expect(mockQuit).not.toHaveBeenCalled();
    });
  });
});
