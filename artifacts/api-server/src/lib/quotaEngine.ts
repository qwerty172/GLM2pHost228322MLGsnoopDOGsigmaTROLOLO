import { eq, and, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  hostsTable,
  playersTable,
  quotasTable,
  quotaSessionsTable,
  billingEventsTable,
  type Quota,
} from "@workspace/db";

// Pure-function math for quota effects on a single per-minute billing tick.
// Inputs are integer LZT; output is integer LZT and never exceeds the input
// (so the billing path can't push the player or host below zero).
//
// Returned shape (all in integer LZT):
//   royaltyLzt — taken either from the player (added to debit) or from the
//                host's payout, depending on royaltySource. The recipient is
//                the quota owner.
//   sponsorHostLzt   — paid out of escrow to the host on top of their cut.
//   sponsorPlayerLzt — paid out of escrow to the player on top of their cut.
export interface QuotaTickEffect {
  royaltyLzt: number;
  sponsorHostLzt: number;
  sponsorPlayerLzt: number;
}

export function computeQuotaEffect(
  quota: Quota,
  perMinuteLzt: number,
  minutesIntoSession: number,
): QuotaTickEffect {
  const out: QuotaTickEffect = {
    royaltyLzt: 0,
    sponsorHostLzt: 0,
    sponsorPlayerLzt: 0,
  };

  // Min/max session-minute window. Quotas only apply inside the window.
  if (
    quota.minSessionMinutes != null &&
    minutesIntoSession < quota.minSessionMinutes
  ) {
    return out;
  }
  if (
    quota.maxSessionMinutes != null &&
    minutesIntoSession > quota.maxSessionMinutes
  ) {
    return out;
  }

  if (quota.kind === "royalty") {
    if (quota.royaltyBasis === "percent" && quota.royaltyValue != null) {
      const pct = Math.max(0, Math.min(100, quota.royaltyValue));
      const cut = Math.floor((perMinuteLzt * pct) / 100);
      out.royaltyLzt = Math.min(cut, perMinuteLzt);
    } else if (
      quota.royaltyBasis === "fixed_per_minute" &&
      quota.royaltyValue != null
    ) {
      out.royaltyLzt = Math.max(
        0,
        Math.min(quota.royaltyValue, perMinuteLzt),
      );
    }
  } else if (quota.kind === "sponsor") {
    const escrow = Math.max(0, quota.escrowRemainingLzt ?? 0);
    const hostAdd = Math.max(0, quota.sponsorHostPerMinuteLzt ?? 0);
    const playerAdd = Math.max(0, quota.sponsorPlayerPerMinuteLzt ?? 0);
    const wanted = hostAdd + playerAdd;
    if (wanted > 0 && escrow > 0) {
      if (wanted <= escrow) {
        out.sponsorHostLzt = hostAdd;
        out.sponsorPlayerLzt = playerAdd;
      } else {
        // Pro-rate the last partial tick so we use up the escrow exactly
        // without overspending. Host gets paid first, leftover goes to player.
        const hostPay = Math.min(hostAdd, escrow);
        const left = escrow - hostPay;
        out.sponsorHostLzt = hostPay;
        out.sponsorPlayerLzt = Math.min(playerAdd, left);
      }
    }
  }
  return out;
}

export function generateAccessCode(): string {
  // 8 base32 chars — short enough to share, big enough not to brute-force.
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

// Credit LZT to a host or player owner's green (withdrawable) balance, using
// the supplied transaction handle. Used both for royalty/sponsor payouts and
// for escrow refunds.
export async function creditOwnerGreen(
  tx: NodePgDatabase<Record<string, unknown>>,
  ownerType: string,
  ownerId: string,
  amountLzt: number,
): Promise<void> {
  if (amountLzt <= 0) return;
  if (ownerType === "host") {
    await tx
      .update(hostsTable)
      .set({
        withdrawableBalanceLzt: sql`${hostsTable.withdrawableBalanceLzt} + ${amountLzt}`,
      })
      .where(eq(hostsTable.id, ownerId));
  } else {
    await tx
      .update(playersTable)
      .set({
        withdrawableBalanceLzt: sql`${playersTable.withdrawableBalanceLzt} + ${amountLzt}`,
      })
      .where(eq(playersTable.id, ownerId));
  }
}

// Atomically decrement a quota's escrow by amountLzt and return true if the
// update applied. Caller must check the return value before relying on the
// decrement (concurrent ticks may race the same row).
export async function decrementEscrow(
  tx: NodePgDatabase<Record<string, unknown>>,
  quotaId: string,
  amountLzt: number,
): Promise<boolean> {
  if (amountLzt <= 0) return true;
  const updated = await tx
    .update(quotasTable)
    .set({
      escrowRemainingLzt: sql`${quotasTable.escrowRemainingLzt} - ${amountLzt}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(quotasTable.id, quotaId),
        sql`${quotasTable.escrowRemainingLzt} >= ${amountLzt}`,
      ),
    )
    .returning({ id: quotasTable.id });
  return updated.length > 0;
}

// Apply a billing-events row for a quota movement (separate row per delta —
// keeps the wallet ledger queryable by `kind` and `quotaId`).
export async function recordQuotaMovement(
  tx: NodePgDatabase<Record<string, unknown>>,
  args: {
    sessionId: string;
    hostId: string;
    playerId: string;
    quotaId: string;
    kind: string;
    amountLzt: number;
    bucket?: string;
  },
): Promise<void> {
  await tx.insert(billingEventsTable).values({
    sessionId: args.sessionId,
    hostId: args.hostId,
    playerId: args.playerId,
    minutes: 0,
    bucket: args.bucket ?? "green",
    playerDebitLzt: 0,
    hostCreditLzt: args.amountLzt,
    kind: args.kind,
    quotaId: args.quotaId,
  });
}

// Bump the per-session running totals so the quota's stats page is cheap.
export async function bumpQuotaSessionTotals(
  tx: NodePgDatabase<Record<string, unknown>>,
  args: {
    quotaId: string;
    sessionId: string;
    royaltyLzt: number;
    sponsorHostLzt: number;
    sponsorPlayerLzt: number;
  },
): Promise<void> {
  await tx
    .update(quotaSessionsTable)
    .set({
      totalRoyaltyLzt: sql`${quotaSessionsTable.totalRoyaltyLzt} + ${args.royaltyLzt}`,
      totalSponsorHostLzt: sql`${quotaSessionsTable.totalSponsorHostLzt} + ${args.sponsorHostLzt}`,
      totalSponsorPlayerLzt: sql`${quotaSessionsTable.totalSponsorPlayerLzt} + ${args.sponsorPlayerLzt}`,
      minutesBilled: sql`${quotaSessionsTable.minutesBilled} + 1`,
    })
    .where(
      and(
        eq(quotaSessionsTable.quotaId, args.quotaId),
        eq(quotaSessionsTable.sessionId, args.sessionId),
      ),
    );
}

export function isQuotaActiveNow(q: Quota, now: Date = new Date()): boolean {
  return isQuotaBillingActive(q, now);
}

/** Whether sponsor/royalty quota effects apply on a billing tick. */
export function isQuotaBillingActive(
  q: Quota,
  now: Date = new Date(),
  opts: { grandfatherPastEndAt?: boolean } = {},
): boolean {
  if (q.status !== "active") return false;
  if (q.startAt && q.startAt > now) return false;
  if (q.kind === "sponsor" && (q.escrowRemainingLzt ?? 0) <= 0) return false;
  if (!q.endAt || q.endAt >= now) return true;
  // Past end_at: keep covering in-flight sessions that were attached earlier.
  return opts.grandfatherPastEndAt === true;
}
