export interface LimitedUserConfig {
  enabled: boolean;
  username: string;
  password: string;
  domain?: string;
}

export function validateLimitedUserLaunch(
  creds: LimitedUserConfig,
  platform: NodeJS.Platform = process.platform,
): { ok: true } | { ok: false; error: string } {
  if (platform !== "win32") {
    return { ok: false, error: "Limited user launch is Windows-only" };
  }
  if (!creds.enabled || !creds.username || !creds.password) {
    return { ok: false, error: "Limited user credentials not configured" };
  }
  return { ok: true };
}
