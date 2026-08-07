/** Deep-link parsing for decenthub:// URLs opened from the host dashboard (U-34). */

export const DECENTHUB_PROTOCOL_SCHEME = "decenthub";

export type DecenthubDeepLink = {
  action: "open" | "bind";
  apiBaseUrl: string | null;
  bindCode: string | null;
  pairCode: string | null;
};

export type PendingDeepLinkPayload = {
  apiBaseUrl: string | null;
  bindCode: string | null;
  pairCode: string | null;
};

export function parseDecenthubUrl(raw: string): DecenthubDeepLink | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== `${DECENTHUB_PROTOCOL_SCHEME}:`) return null;
  const action =
    url.hostname === "bind" ? "bind" : url.hostname === "open" ? "open" : null;
  if (!action) return null;
  return {
    action,
    apiBaseUrl: url.searchParams.get("api")?.trim() || null,
    bindCode: url.searchParams.get("bind")?.trim() || null,
    pairCode: url.searchParams.get("pair")?.trim() || null,
  };
}

export function findDecenthubUrlInArgv(argv: string[]): string | null {
  for (const arg of argv) {
    if (arg.startsWith(`${DECENTHUB_PROTOCOL_SCHEME}://`)) return arg;
  }
  return null;
}

export function toPendingPayload(link: DecenthubDeepLink): PendingDeepLinkPayload {
  if (link.action === "open") {
    return { apiBaseUrl: null, bindCode: null, pairCode: null };
  }
  return {
    apiBaseUrl: link.apiBaseUrl,
    bindCode: link.bindCode,
    pairCode: link.pairCode,
  };
}
