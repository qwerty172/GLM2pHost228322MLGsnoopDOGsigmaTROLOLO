/**
 * Trust levels for account portability:
 * 0 = device-locked (default)
 * 1 = dual-app OTP verified (Telegram + Discord)
 * 2 = KYC verified
 * 3 = paid portability unlock ($70)
 */
export type TrustLevel = 0 | 1 | 2 | 3;
export type ProviderName = "telegram" | "discord";
export type UserType = "host" | "player";

/** Called by each provider to deliver an OTP to the user. */
export interface OtpProvider {
  name: ProviderName;
  /** Send `code` to the user identified by `providerUserId`. */
  sendOtp(providerUserId: string, code: string): Promise<void>;
}

/** Database access contract — injected by the host application. */
export interface VerifierDb {
  // Link tokens (short-lived, for the /link flow)
  insertLinkToken(row: {
    token: string;
    userId: string;
    userType: UserType;
    provider: ProviderName;
    expiresAt: Date;
  }): Promise<void>;
  consumeLinkToken(token: string): Promise<{
    userId: string;
    userType: UserType;
    provider: ProviderName;
  } | null>;

  // Linked accounts
  upsertLink(row: {
    userId: string;
    userType: UserType;
    provider: ProviderName;
    providerUserId: string;
    providerUsername: string | null;
  }): Promise<void>;
  getLinks(userId: string, userType: UserType): Promise<
    Array<{ provider: ProviderName; providerUserId: string; providerUsername: string | null }>
  >;

  // Challenges
  insertChallenge(row: {
    id: string;
    userId: string;
    userType: UserType;
    purpose: string;
    codes: Record<ProviderName, string>;
    expiresAt: Date;
  }): Promise<void>;
  getChallenge(id: string): Promise<{
    userId: string;
    userType: UserType;
    purpose: string;
    codes: Record<ProviderName, string>;
    verifiedProviders: ProviderName[];
    expiresAt: Date;
    completedAt: Date | null;
  } | null>;
  markProviderVerified(id: string, provider: ProviderName): Promise<ProviderName[]>;
  completeChallenge(id: string): Promise<void>;

  // Trust level
  setTrustLevel(userId: string, userType: UserType, level: number): Promise<void>;
}

export interface VerifierConfig {
  db: VerifierDb;
  providers: OtpProvider[];
  /** OTP TTL in seconds, default 300 (5 min) */
  otpTtlSec?: number;
  /** Link token TTL in seconds, default 600 (10 min) */
  linkTtlSec?: number;
}
