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
  try {
    localStorage.removeItem(ADMIN_SECRET_KEY);
  } catch {
    /* ignore */
  }
}

export function adminRequestHeaders(hostToken: string): Record<string, string> {
  const secret = readAdminSecret();
  return {
    "X-Host-Token": hostToken,
    ...(secret ? { "X-Admin-Secret": secret } : {}),
  };
}

export function apiErrorMessage(err: unknown, fallback = "Ошибка запроса"): string {
  if (err && typeof err === "object" && "data" in err) {
    const data = (err as { data?: { error?: string; message?: string } }).data;
    if (data?.error) return data.error;
    if (data?.message) return data.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
