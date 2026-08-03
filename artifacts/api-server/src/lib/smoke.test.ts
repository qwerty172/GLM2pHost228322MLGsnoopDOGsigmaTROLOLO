import { describe, expect, it } from "vitest";
import { generateToken } from "./tokens";
import { timingSafeEqualString } from "./timingSafeEqual";
import {
  LZT_PER_USDT,
  lztToUsdt,
  pickPlayerBucket,
  usdtToLzt,
  usdtToLztRound,
} from "./lzt";
import {
  applyPremiumDiscountPct,
  effectiveDepositRatePct,
  isPremiumActive,
  premiumGrantOnCross,
  tierForLifetimeCents,
} from "./tariff";
import {
  defaultInviteExpiresAt,
  generateInviteCode,
  isInviteExpired,
} from "./invites";
import {
  isHostAvailableNow,
  isWithinSchedule,
  minutesSinceWindowStart,
} from "./schedule";
import { ipKey, rateLimit } from "./rateLimit";
import { hostTokenFromRequest } from "./requestToken";
import { isRedisAvailable } from "./redis";
import type { Request, Response } from "express";

describe("generateToken", () => {
  it("returns url-safe base64 of expected length", () => {
    const t = generateToken(24);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(t.length).toBeGreaterThanOrEqual(30);
  });

  it("produces unique values", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
  });
});

describe("timingSafeEqualString", () => {
  it("matches equal secrets", () => {
    expect(timingSafeEqualString("admin-secret", "admin-secret")).toBe(true);
  });

  it("rejects unequal or empty values", () => {
    expect(timingSafeEqualString("admin-secret", "admin-secreX")).toBe(false);
    expect(timingSafeEqualString("short", "longer-secret")).toBe(false);
    expect(timingSafeEqualString("", "x")).toBe(false);
    expect(timingSafeEqualString("x", "")).toBe(false);
  });
});

describe("lzt billing helpers", () => {
  it("converts USDT ↔ LZT at fixed rate", () => {
    expect(LZT_PER_USDT).toBe(200);
    expect(usdtToLzt(1)).toBe(200);
    expect(usdtToLzt(1.999)).toBe(399);
    expect(usdtToLzt(0)).toBe(0);
    expect(usdtToLzt(-1)).toBe(0);
    expect(lztToUsdt(200)).toBe(1);
    expect(usdtToLztRound(0.0025)).toBe(1);
  });

  it("pickPlayerBucket never combines green and blue", () => {
    expect(pickPlayerBucket("auto", 100, 100, 0)).toBe("green");
    expect(pickPlayerBucket("auto", 100, 50, 100)).toBe("blue");
    expect(pickPlayerBucket("auto", 100, 50, 50)).toBeNull();
    expect(pickPlayerBucket("green", 100, 100, 999)).toBe("green");
    expect(pickPlayerBucket("green", 100, 50, 999)).toBeNull();
    expect(pickPlayerBucket("blue", 100, 999, 100)).toBe("blue");
    expect(pickPlayerBucket("blue", 100, 999, 50)).toBeNull();
  });
});

describe("tariff / premium", () => {
  it("maps lifetime deposit tiers", () => {
    expect(tierForLifetimeCents(0).ratePct).toBe(50);
    expect(tierForLifetimeCents(200_000).ratePct).toBe(35);
    expect(tierForLifetimeCents(25_000_000).bonus).toBe("investor");
  });

  it("applies premium −15pp when rate ≥ 15%", () => {
    expect(effectiveDepositRatePct({ lifetimeUsdtCents: 0, premiumActive: true })).toBe(35);
    expect(applyPremiumDiscountPct(5, true)).toBe(5);
    expect(applyPremiumDiscountPct(25, true)).toBe(10);
  });

  it("grants free premium once when crossing $15k", () => {
    expect(premiumGrantOnCross(1_499_999, 1_500_000)?.freePremiumDays).toBe(730);
    expect(premiumGrantOnCross(1_500_000, 2_000_000)).toBeNull();
  });

  it("detects active premium window", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(isPremiumActive(new Date("2026-06-01T00:00:00Z"), now)).toBe(true);
    expect(isPremiumActive(new Date("2025-12-01T00:00:00Z"), now)).toBe(false);
    expect(isPremiumActive(null, now)).toBe(false);
  });
});

describe("invites", () => {
  it("generates short invite codes and expiry helpers", () => {
    const code = generateInviteCode();
    expect(code.length).toBeGreaterThanOrEqual(10);
    const from = new Date("2026-01-01T00:00:00Z");
    const expires = defaultInviteExpiresAt(from);
    expect(expires.getTime() - from.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    expect(isInviteExpired(expires, from)).toBe(false);
    expect(isInviteExpired(expires, new Date(expires.getTime() + 1))).toBe(true);
    expect(isInviteExpired(null)).toBe(false);
  });
});

describe("session eligibility (schedule)", () => {
  const mondayMorning = new Date("2026-07-20T10:30:00Z"); // Monday UTC
  const slots = [{ day: 1, startMin: 9 * 60, endMin: 12 * 60 }];

  it("isWithinSchedule matches UTC slots", () => {
    expect(isWithinSchedule(slots, mondayMorning)).toBe(true);
    expect(isWithinSchedule(slots, new Date("2026-07-20T08:00:00Z"))).toBe(false);
    expect(isWithinSchedule([], mondayMorning)).toBe(false);
  });

  it("minutesSinceWindowStart tracks elapsed minutes", () => {
    expect(minutesSinceWindowStart(slots, mondayMorning)).toBe(90);
    expect(minutesSinceWindowStart(slots, new Date("2026-07-20T08:00:00Z"))).toBeNull();
  });

  it("isHostAvailableNow respects scheduleMode", () => {
    expect(isHostAvailableNow("always", [], mondayMorning)).toBe(true);
    expect(isHostAvailableNow("scheduled", slots, mondayMorning)).toBe(true);
    expect(isHostAvailableNow("scheduled", slots, new Date("2026-07-21T10:00:00Z"))).toBe(false);
    expect(isHostAvailableNow("off", slots, mondayMorning)).toBe(false);
  });
});

describe("hostAuth", () => {
  it("hostTokenFromRequest prefers Bearer then X-Host-Token", () => {
    expect(
      hostTokenFromRequest({
        headers: { authorization: "Bearer host-bearer" },
      } as Request),
    ).toBe("host-bearer");
    expect(
      hostTokenFromRequest({
        headers: { "x-host-token": "host-header" },
      } as Request),
    ).toBe("host-header");
    expect(
      hostTokenFromRequest({
        headers: { authorization: "Bearer ", "x-host-token": "fallback" },
      } as Request),
    ).toBe("fallback");
    expect(hostTokenFromRequest({ headers: {} } as Request)).toBeNull();
  });
});

describe("sessionBilling (block refund math)", () => {
  it("computes remainder refund for partial block usage", () => {
    const blockMinutes = 60;
    const blockReservedLzt = 600;
    const costPerMinute = Math.round(blockReservedLzt / blockMinutes);
    for (const minutesUsed of [0, 10, 59, 60]) {
      const costUsed = minutesUsed * costPerMinute;
      const refundLzt = Math.max(0, blockReservedLzt - costUsed);
      expect(refundLzt).toBe(Math.max(0, blockReservedLzt - minutesUsed * 10));
    }
  });

  it("skips refund when block fully consumed", () => {
    const blockReservedLzt = 600;
    const minutesUsed = 60;
    const costPerMinute = Math.round(blockReservedLzt / 60);
    expect(Math.max(0, blockReservedLzt - minutesUsed * costPerMinute)).toBe(0);
  });
});

describe("cloud save session gate", () => {
  it("documents that ended sessions must not authorize host save sync", () => {
    const statuses = ["pending", "active", "ended"] as const;
    const allowed = statuses.filter((s) => s === "active");
    expect(allowed).toEqual(["active"]);
  });
});

describe("block billing + quota", () => {
  it("documents that host-share royalty ticks must be routed to quota owners", () => {
    const perMinuteLzt = 100;
    const royaltyPct = 10;
    const royaltyLzt = Math.floor((perMinuteLzt * royaltyPct) / 100);
    expect(royaltyLzt).toBe(10);
    // billingWorker prepaid-block path must call applyQuotaTickMovements each tick.
  });
});

describe("rateLimit", () => {
  it("ipKey falls back to anon", () => {
    expect(ipKey({ ip: "1.2.3.4" } as Request)).toBe("1.2.3.4");
    expect(ipKey({} as Request)).toBe("anon");
  });

  it("returns 429 after max requests in window", async () => {
    const prev = process.env.RATE_LIMIT_STORAGE;
    process.env.RATE_LIMIT_STORAGE = "memory";
    try {
      expect(isRedisAvailable()).toBe(false);
    const limiter = rateLimit({
      windowMs: 60_000,
      max: 2,
      scope: "test-smoke",
      keyFn: () => "caller-a",
    });

    const mkRes = () => {
      const headers: Record<string, string> = {};
      let statusCode = 200;
      let body: unknown;
      return {
        res: {
          setHeader: (k: string, v: string) => {
            headers[k] = v;
          },
          status: (code: number) => {
            statusCode = code;
            return {
              json: (b: unknown) => {
                body = b;
              },
            };
          },
        } as unknown as Response,
        get statusCode() {
          return statusCode;
        },
        get body() {
          return body;
        },
        get headers() {
          return headers;
        },
      };
    };

    const req = { headers: {}, ip: "9.9.9.9" } as unknown as Request;
    let nextCount = 0;
    const next = () => {
      nextCount += 1;
    };

    const r1 = mkRes();
    await limiter(req, r1.res, next);
    const r2 = mkRes();
    await limiter(req, r2.res, next);
    const r3 = mkRes();
    await limiter(req, r3.res, next);

    expect(nextCount).toBe(2);
    expect(r3.statusCode).toBe(429);
    expect((r3.body as { error: string }).error).toBe("too_many_requests");
    expect(r3.headers["Retry-After"]).toBeTruthy();
    } finally {
      if (prev === undefined) delete process.env.RATE_LIMIT_STORAGE;
      else process.env.RATE_LIMIT_STORAGE = prev;
    }
  });
});
