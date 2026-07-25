import crypto from "node:crypto";
import { generateOtp, verifyOtp } from "./otp.js";
import type { VerifierConfig, ProviderName, UserType } from "./types.js";

export type ChallengeStatus =
  | { state: "pending"; verifiedProviders: ProviderName[]; remaining: ProviderName[] }
  | { state: "complete" }
  | { state: "expired" };

/**
 * Create a new dual-OTP challenge.
 * Sends OTPs to all linked providers and returns the challenge ID.
 */
export async function createChallenge(
  cfg: VerifierConfig,
  userId: string,
  userType: UserType,
  purpose: string,
): Promise<{ challengeId: string; providers: ProviderName[] }> {
  const links = await cfg.db.getLinks(userId, userType);
  if (links.length < 2) {
    throw new Error(
      `Need at least 2 linked providers for dual-OTP; user has ${links.length}.`,
    );
  }

  const ttl = cfg.otpTtlSec ?? 300;
  const codes: Partial<Record<ProviderName, string>> = {};
  for (const link of links) {
    codes[link.provider] = generateOtp();
  }

  const challengeId = crypto.randomUUID();
  await cfg.db.insertChallenge({
    id: challengeId,
    userId,
    userType,
    purpose,
    codes: codes as Record<ProviderName, string>,
    expiresAt: new Date(Date.now() + ttl * 1000),
  });

  // Send OTPs in parallel — don't let one failure block the other
  const providerMap = new Map(cfg.providers.map((p) => [p.name, p]));
  await Promise.all(
    links.map(async (link) => {
      const provider = providerMap.get(link.provider);
      if (!provider) return;
      const code = codes[link.provider]!;
      await provider.sendOtp(link.providerUserId, code);
    }),
  );

  return {
    challengeId,
    providers: links.map((l) => l.provider),
  };
}

/**
 * Submit a code for one provider in a challenge.
 * Returns the updated status.
 */
export async function submitCode(
  cfg: VerifierConfig,
  challengeId: string,
  provider: ProviderName,
  submittedCode: string,
): Promise<{ ok: boolean; status: ChallengeStatus }> {
  const challenge = await cfg.db.getChallenge(challengeId);

  if (!challenge) return { ok: false, status: { state: "expired" } };
  if (challenge.completedAt) return { ok: true, status: { state: "complete" } };
  if (challenge.expiresAt < new Date()) {
    return { ok: false, status: { state: "expired" } };
  }

  const expectedCode = challenge.codes[provider];
  if (!expectedCode) {
    return { ok: false, status: challengeStatus(challenge) };
  }

  if (!verifyOtp(submittedCode.replace(/\s/g, ""), expectedCode)) {
    return { ok: false, status: challengeStatus(challenge) };
  }

  // Mark this provider verified
  const nowVerified = await cfg.db.markProviderVerified(challengeId, provider);

  // Determine how many providers were expected (all keys in codes)
  const needed = Object.keys(challenge.codes) as ProviderName[];
  const allVerified = needed.every((p) => nowVerified.includes(p));

  if (allVerified) {
    await cfg.db.completeChallenge(challengeId);
    // Elevate trust level: dual-OTP = level 1
    if (challenge.purpose === "link_elevation") {
      await cfg.db.setTrustLevel(challenge.userId, challenge.userType, 1);
    }
    return { ok: true, status: { state: "complete" } };
  }

  const remaining = needed.filter((p) => !nowVerified.includes(p));
  return {
    ok: true,
    status: { state: "pending", verifiedProviders: nowVerified, remaining },
  };
}

export async function getChallengeStatus(
  cfg: VerifierConfig,
  challengeId: string,
): Promise<ChallengeStatus> {
  const challenge = await cfg.db.getChallenge(challengeId);
  if (!challenge) return { state: "expired" };
  if (challenge.completedAt) return { state: "complete" };
  if (challenge.expiresAt < new Date()) return { state: "expired" };
  return challengeStatus(challenge);
}

function challengeStatus(challenge: {
  codes: Record<ProviderName, string>;
  verifiedProviders: ProviderName[];
}): ChallengeStatus {
  const needed = Object.keys(challenge.codes) as ProviderName[];
  const remaining = needed.filter(
    (p) => !challenge.verifiedProviders.includes(p),
  );
  return {
    state: "pending",
    verifiedProviders: challenge.verifiedProviders,
    remaining,
  };
}
