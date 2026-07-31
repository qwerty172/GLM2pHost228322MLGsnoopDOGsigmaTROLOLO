export const ADMIN_SECRET_KEY = "streamline.adminSecret";

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
  try {
    localStorage.removeItem(ADMIN_SECRET_KEY);
  } catch {
    /* ignore */
  }
}

/** RequestInit with admin auth headers for codegen hooks (`request` option). */
export function adminRequestInit(
  hostToken: string,
  adminSecret?: string,
): RequestInit {
  const secret = adminSecret ?? readAdminSecret();
  return {
    headers: {
      "X-Host-Token": hostToken,
      ...(secret ? { "X-Admin-Secret": secret } : {}),
    },
  };
}

/** Extract a user-facing error string from a React Query / ApiError failure. */
export function apiErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "data" in err) {
    const data = (err as { data?: unknown }).data;
    if (data && typeof data === "object" && "error" in data) {
      const msg = (data as { error?: unknown }).error;
      if (typeof msg === "string") return msg;
    }
  }
  if (err instanceof Error) return err.message;
  return String(err);
}
