import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  withdrawalBackoffMs,
  isWithdrawalReadyForRetry,
} from "../lib/withdrawalScheduling.js";
import { hotWalletEnvVar } from "../lib/hotWallets.js";
import { PayoutError } from "../lib/walletPayout.js";

describe("withdrawalWorker", () => {
  it("backoff grows exponentially and caps at max", () => {
    assert.equal(withdrawalBackoffMs(0), 0);
    assert.equal(withdrawalBackoffMs(1), 60_000);
    assert.equal(withdrawalBackoffMs(2), 120_000);
    assert.equal(withdrawalBackoffMs(3), 240_000);
    assert.ok(withdrawalBackoffMs(20) <= 30 * 60_000);
  });

  it("pending withdrawal respects backoff window", () => {
    const now = new Date("2026-07-28T12:00:00Z");
    const requestedAt = new Date("2026-07-28T11:58:01Z");
    assert.equal(
      isWithdrawalReadyForRetry(
        {
          status: "pending",
          attempts: 2,
          requestedAt,
          processingAt: null,
        },
        now,
      ),
      false,
    );
    assert.equal(
      isWithdrawalReadyForRetry(
        {
          status: "pending",
          attempts: 2,
          requestedAt: new Date("2026-07-28T11:57:59Z"),
          processingAt: null,
        },
        now,
      ),
      true,
    );
  });

  it("stuck processing withdrawal becomes eligible", () => {
    const now = new Date("2026-07-28T12:00:00Z");
    assert.equal(
      isWithdrawalReadyForRetry(
        {
          status: "processing",
          attempts: 1,
          requestedAt: new Date("2026-07-28T11:00:00Z"),
          processingAt: new Date("2026-07-28T11:40:00Z"),
        },
        now,
      ),
      true,
    );
  });

  it("maps currencies to hot-wallet env vars", () => {
    assert.equal(hotWalletEnvVar("SOL"), "WALLET_HOT_SOL_ENCRYPTED");
    assert.equal(hotWalletEnvVar("NANO"), "WALLET_HOT_NANO_ENCRYPTED");
    assert.equal(hotWalletEnvVar("USDT_TRC20"), "WALLET_HOT_TRON_ENCRYPTED");
    assert.equal(hotWalletEnvVar("BTC"), undefined);
  });
});

describe("walletPayout", () => {
  it("PayoutError carries retryable flag", () => {
    const retryable = new PayoutError("rate limit", true);
    const fatal = new PayoutError("bad address", false);
    assert.equal(retryable.retryable, true);
    assert.equal(fatal.retryable, false);
  });
});
