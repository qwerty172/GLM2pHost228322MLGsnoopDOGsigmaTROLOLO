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

export function getAdminHeaders(hostToken: string): Record<string, string> {
  const secret = readAdminSecret();
  return {
    "X-Host-Token": hostToken,
    ...(secret ? { "X-Admin-Secret": secret } : {}),
  };
}

export function formatAdminError(err: unknown): string {
  if (err && typeof err === "object" && "data" in err) {
    const data = (err as { data: unknown }).data;
    if (data && typeof data === "object" && "error" in data) {
      const code = (data as { error: unknown }).error;
      if (typeof code === "string") return code;
    }
  }
  return err instanceof Error ? err.message : String(err);
}
