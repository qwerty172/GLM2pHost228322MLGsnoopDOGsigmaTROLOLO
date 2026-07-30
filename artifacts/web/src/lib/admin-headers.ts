const ADMIN_SECRET_KEY = "streamline.adminSecret";

export function readAdminSecret(): string {
  try {
    return sessionStorage.getItem(ADMIN_SECRET_KEY) ?? "";
  } catch {
    return "";
  }
}

export function writeAdminSecret(value: string): void {
  try {
    if (value) sessionStorage.setItem(ADMIN_SECRET_KEY, value);
    else sessionStorage.removeItem(ADMIN_SECRET_KEY);
  } catch {
    /* sessionStorage unavailable */
  }
  // Migrate away from the older localStorage copy (persists across sessions).
  try {
    localStorage.removeItem(ADMIN_SECRET_KEY);
  } catch {
    /* ignore */
  }
}

export function adminHeaders(hostToken: string): Record<string, string> {
  const secret = readAdminSecret();
  return {
    "X-Host-Token": hostToken,
    ...(secret ? { "X-Admin-Secret": secret } : {}),
  };
}
