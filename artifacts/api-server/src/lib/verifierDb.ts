/**
 * Drizzle-backed implementation of the VerifierDb interface
 * consumed by @workspace/auth-verifier.
 */
import { eq, and, isNull, gt } from "drizzle-orm";
import {
  db,
  verifierLinksTable,
  verifierLinkTokensTable,
  verifierChallengesTable,
  playersTable,
  hostsTable,
} from "@workspace/db";
import type { VerifierDb, ProviderName, UserType } from "@workspace/auth-verifier";

export const verifierDb: VerifierDb = {
  // ── Link tokens ────────────────────────────────────────────────────────
  async insertLinkToken(row) {
    await db.insert(verifierLinkTokensTable).values({
      token: row.token,
      userId: row.userId,
      userType: row.userType as "host" | "player",
      provider: row.provider as "telegram" | "discord",
      expiresAt: row.expiresAt,
    });
  },

  async consumeLinkToken(token) {
    const now = new Date();
    const [row] = await db
      .select()
      .from(verifierLinkTokensTable)
      .where(
        and(
          eq(verifierLinkTokensTable.token, token.toUpperCase()),
          isNull(verifierLinkTokensTable.consumedAt),
          gt(verifierLinkTokensTable.expiresAt, now),
        ),
      );
    if (!row) return null;

    await db
      .update(verifierLinkTokensTable)
      .set({ consumedAt: now })
      .where(eq(verifierLinkTokensTable.id, row.id));

    return {
      userId: row.userId,
      userType: row.userType as UserType,
      provider: row.provider as ProviderName,
    };
  },

  // ── Linked accounts ────────────────────────────────────────────────────
  async upsertLink(row) {
    // Deactivate any existing link for the same user+provider
    await db
      .update(verifierLinksTable)
      .set({ active: false })
      .where(
        and(
          eq(verifierLinksTable.userId, row.userId),
          eq(verifierLinksTable.provider, row.provider as "telegram" | "discord"),
        ),
      );

    await db.insert(verifierLinksTable).values({
      userId: row.userId,
      userType: row.userType as "host" | "player",
      provider: row.provider as "telegram" | "discord",
      providerUserId: row.providerUserId,
      providerUsername: row.providerUsername ?? null,
      active: true,
    });
  },

  async getLinks(userId, userType) {
    const rows = await db
      .select()
      .from(verifierLinksTable)
      .where(
        and(
          eq(verifierLinksTable.userId, userId),
          eq(verifierLinksTable.userType, userType as "host" | "player"),
          eq(verifierLinksTable.active, true),
        ),
      );
    return rows.map((r) => ({
      provider: r.provider as ProviderName,
      providerUserId: r.providerUserId,
      providerUsername: r.providerUsername,
    }));
  },

  // ── Challenges ─────────────────────────────────────────────────────────
  async insertChallenge(row) {
    await db.insert(verifierChallengesTable).values({
      id: row.id,
      userId: row.userId,
      userType: row.userType as "host" | "player",
      purpose: row.purpose,
      codes: JSON.stringify(row.codes),
      verifiedProviders: "[]",
      expiresAt: row.expiresAt,
    });
  },

  async getChallenge(id) {
    const [row] = await db
      .select()
      .from(verifierChallengesTable)
      .where(eq(verifierChallengesTable.id, id));
    if (!row) return null;

    return {
      userId: row.userId,
      userType: row.userType as UserType,
      purpose: row.purpose,
      codes: JSON.parse(row.codes) as Record<ProviderName, string>,
      verifiedProviders: JSON.parse(row.verifiedProviders) as ProviderName[],
      expiresAt: row.expiresAt,
      completedAt: row.completedAt,
    };
  },

  async markProviderVerified(id, provider) {
    const [row] = await db
      .select({ verifiedProviders: verifierChallengesTable.verifiedProviders })
      .from(verifierChallengesTable)
      .where(eq(verifierChallengesTable.id, id));
    if (!row) return [];

    const current = JSON.parse(row.verifiedProviders) as ProviderName[];
    if (current.includes(provider)) return current;
    const updated = [...current, provider];
    await db
      .update(verifierChallengesTable)
      .set({ verifiedProviders: JSON.stringify(updated) })
      .where(eq(verifierChallengesTable.id, id));
    return updated;
  },

  async completeChallenge(id) {
    await db
      .update(verifierChallengesTable)
      .set({ completedAt: new Date() })
      .where(eq(verifierChallengesTable.id, id));
  },

  // ── Trust level ────────────────────────────────────────────────────────
  async setTrustLevel(userId, userType, level) {
    if (userType === "player") {
      await db
        .update(playersTable)
        .set({ trustLevel: level })
        .where(eq(playersTable.id, userId));
    } else {
      await db
        .update(hostsTable)
        .set({ trustLevel: level })
        .where(eq(hostsTable.id, userId));
    }
  },
};
