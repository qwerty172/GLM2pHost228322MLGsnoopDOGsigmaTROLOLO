import { and, eq, inArray, lt, or, sql } from "drizzle-orm";
import { db, withdrawalsTable } from "@workspace/db";
import { logger } from "./logger";
import { isWalletCryptoEnabled } from "./encryption";
import { isHotWalletConfigured } from "./hotWallets";
import { PayoutError, sendWithdrawalPayout } from "./walletPayout";
import { refundWithdrawalDebit } from "./economy";
import { usdtToLzt } from "./lzt";
import {
  isWithdrawalReadyForRetry,
  STUCK_PROCESSING_MS,
  withdrawalBackoffMs,
} from "./withdrawalScheduling";

const POLL_INTERVAL_MS = Number(
  process.env["WALLET_WITHDRAW_POLL_MS"] ?? 60_000,
);
const MAX_ATTEMPTS = Number(process.env["WALLET_WITHDRAW_MAX_ATTEMPTS"] ?? 8);

let interval: NodeJS.Timeout | null = null;
let isPolling = false;

async function markFailed(
  withdrawalId: string,
  ownerType: "host" | "player",
  ownerId: string,
  amountLzt: number,
  lastError: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await refundWithdrawalDebit(tx, {
      ownerType,
      ownerId,
      amountLzt,
      withdrawalId,
    });
    await tx
      .update(withdrawalsTable)
      .set({
        status: "failed",
        lastError,
        processingAt: null,
        completedAt: null,
      })
      .where(eq(withdrawalsTable.id, withdrawalId));
  });
  logger.error(
    { withdrawalId, ownerType, ownerId, amountLzt, lastError },
    "Withdrawal failed permanently — balance refunded",
  );
}

export async function processWithdrawalRow(
  row: typeof withdrawalsTable.$inferSelect,
): Promise<void> {
  if (row.ownerType !== "host" && row.ownerType !== "player") {
    logger.warn({ id: row.id, ownerType: row.ownerType }, "Skip withdrawal for unsupported owner");
    return;
  }
  if (!isHotWalletConfigured(row.currency)) {
    logger.debug(
      { id: row.id, currency: row.currency },
      "Hot wallet not configured — withdrawal stays pending",
    );
    return;
  }

  const amountUsdt = Number(row.amount);
  const amountLzt = usdtToLzt(amountUsdt);
  const nextAttempts = row.attempts + 1;

  const [claimed] = await db
    .update(withdrawalsTable)
    .set({
      status: "processing",
      attempts: nextAttempts,
      processingAt: new Date(),
      lastError: null,
    })
    .where(
      and(
        eq(withdrawalsTable.id, row.id),
        inArray(withdrawalsTable.status, ["pending", "processing"]),
      ),
    )
    .returning();

  if (!claimed) return;

  try {
    const result = await sendWithdrawalPayout({
      currency: row.currency,
      toAddress: row.address,
      amountUsdt,
    });
    await db
      .update(withdrawalsTable)
      .set({
        status: "completed",
        txHash: result.txHash,
        completedAt: new Date(),
        processingAt: null,
        lastError: null,
      })
      .where(eq(withdrawalsTable.id, row.id));
    logger.info(
      {
        withdrawalId: row.id,
        currency: row.currency,
        txHash: result.txHash,
        amountUsdt,
      },
      "Withdrawal completed",
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown payout error";
    const retryable = err instanceof PayoutError ? err.retryable : true;

    if (!retryable || nextAttempts >= MAX_ATTEMPTS) {
      await markFailed(row.id, row.ownerType, row.ownerId, amountLzt, message);
      return;
    }

    await db
      .update(withdrawalsTable)
      .set({
        status: "pending",
        lastError: message,
        processingAt: null,
      })
      .where(eq(withdrawalsTable.id, row.id));

    logger.warn(
      {
        withdrawalId: row.id,
        attempts: nextAttempts,
        maxAttempts: MAX_ATTEMPTS,
        err: message,
        backoffMs: withdrawalBackoffMs(nextAttempts),
      },
      "Withdrawal payout failed — will retry",
    );
  }
}

async function pollOnce(): Promise<void> {
  if (isPolling) {
    logger.debug("Withdrawal poll skipped — previous run still in flight");
    return;
  }
  isPolling = true;
  try {
    const now = new Date();
    const rows = await db
      .select()
      .from(withdrawalsTable)
      .where(
        or(
          eq(withdrawalsTable.status, "pending"),
          and(
            eq(withdrawalsTable.status, "processing"),
            lt(
              withdrawalsTable.processingAt,
              new Date(now.getTime() - STUCK_PROCESSING_MS),
            ),
          ),
        ),
      )
      .orderBy(withdrawalsTable.requestedAt)
      .limit(10);

    for (const row of rows) {
      if (!isWithdrawalReadyForRetry(row, now)) continue;
      await processWithdrawalRow(row);
    }
  } finally {
    isPolling = false;
  }
}

export function startWithdrawalWorker(): void {
  if (interval) return;
  if (process.env["WALLET_WITHDRAW_POLLING"] === "off") {
    logger.info("Withdrawal worker disabled (WALLET_WITHDRAW_POLLING=off)");
    return;
  }
  if (!isWalletCryptoEnabled()) {
    logger.info(
      "Withdrawal worker disabled (WALLET_ENCRYPTION_KEY not configured)",
    );
    return;
  }
  logger.info({ intervalMs: POLL_INTERVAL_MS }, "Starting withdrawal worker");
  interval = setInterval(() => {
    void pollOnce().catch((err) => {
      logger.error({ err }, "Withdrawal poll loop crashed");
    });
  }, POLL_INTERVAL_MS);
  setTimeout(
    () =>
      void pollOnce().catch((err) => {
        logger.error({ err }, "Initial withdrawal poll failed");
      }),
    15_000,
  );
}

export function stopWithdrawalWorker(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}

export { pollOnce as runWithdrawalPollOnce };
