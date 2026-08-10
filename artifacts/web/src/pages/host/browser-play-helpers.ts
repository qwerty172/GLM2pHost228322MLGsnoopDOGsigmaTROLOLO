export const HOST_TOKEN_STORAGE_PREFIX = "streamline.browserHostToken:";
export const BROWSER_HOST_URL_STORAGE_PREFIX = "streamline.browserHostUrl:";
export const GLOBAL_HOST_TOKEN_KEY = "streamline.hostToken";

/** Session-scoped only — browser-host mints a fresh hostToken per session. */
export function getStoredHostToken(
  sessionId: string,
  storage: Pick<Storage, "getItem"> = localStorage,
): string | null {
  try {
    return storage.getItem(HOST_TOKEN_STORAGE_PREFIX + sessionId);
  } catch {
    return null;
  }
}

export function getStoredBrowserHostUrl(
  sessionId: string,
  storage: Pick<Storage, "getItem"> = localStorage,
): string | null {
  try {
    return storage.getItem(BROWSER_HOST_URL_STORAGE_PREFIX + sessionId);
  } catch {
    return null;
  }
}

/** Prefer localStorage; fall back to session.appName when it looks like an external URL. */
export function resolveBrowserHostUrl(
  storedBrowserHostUrl: string | null,
  sessionAppName: string | null | undefined,
): string | null {
  if (storedBrowserHostUrl) return storedBrowserHostUrl;
  const appName = sessionAppName ?? "";
  return /^https?:\/\//i.test(appName) ? appName : null;
}

export function isExternalBrowserHostUrl(browserHostUrl: string | null | undefined): boolean {
  return /^https?:\/\//i.test(browserHostUrl ?? "");
}

export function buildBrowserPlayIframeSrc(baseUrl: string, browserHostUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/${browserHostUrl.replace(/^\//, "")}`;
}

export function buildBrowserPlayShareUrl(opts: {
  origin: string;
  baseUrl: string;
  inviteCode?: string | null;
  playerToken: string;
}): string {
  const base = opts.baseUrl.replace(/\/$/, "");
  if (opts.inviteCode) {
    return `${opts.origin}${base}/play/i/${opts.inviteCode}`;
  }
  return `${opts.origin}${base}/play/${opts.playerToken}`;
}

export function sanitizeIceServers(
  iceServers: Array<{ urls: string | string[] }> | undefined,
): RTCIceServer[] {
  if (!Array.isArray(iceServers) || iceServers.length === 0) {
    return [{ urls: "stun:stun.l.google.com:19302" }];
  }
  const valid = iceServers.filter((s) => {
    const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
    return urls.every(
      (u) => typeof u === "string" && /^(stun|stuns|turn|turns):/i.test(u),
    );
  });
  return valid.length > 0 ? valid : [{ urls: "stun:stun.l.google.com:19302" }];
}

export function buildBrowserHostSignalWsUrl(opts: {
  sessionId: string;
  hostToken: string;
  pageProtocol: string;
  host: string;
  baseUrl: string;
}): string {
  const wsProtocol = opts.pageProtocol === "https:" ? "wss:" : "ws:";
  return (
    `${wsProtocol}//${opts.host}${opts.baseUrl}api/signal` +
    `?role=host&sessionId=${encodeURIComponent(opts.sessionId)}` +
    `&hostToken=${encodeURIComponent(opts.hostToken)}`
  );
}

export function computeEarnedLzt(
  startedAt: string | Date,
  ratePerMinuteUsd: number,
  nowMs: number = Date.now(),
): number {
  const startMs = new Date(startedAt).getTime();
  const ratePerMinLzt = Math.round((ratePerMinuteUsd || 0) * 200);
  const elapsedMin = Math.max(0, (nowMs - startMs) / 60000);
  return Math.floor(elapsedMin * ratePerMinLzt);
}
