/** Разбор ссылки или токена для страницы /play. */
export type PlayLinkTarget =
  | { kind: "invite"; code: string }
  | { kind: "playerToken"; token: string };

function extractAfter(haystack: string, marker: string): string | null {
  const idx = haystack.indexOf(marker);
  if (idx < 0) return null;
  const rest = haystack.slice(idx + marker.length).split(/[/?#]/)[0];
  return rest || null;
}

export function parsePlayLink(raw: string): PlayLinkTarget | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const path =
      trimmed.includes("://") || trimmed.startsWith("/")
        ? new URL(trimmed, window.location.origin).pathname +
          new URL(trimmed, window.location.origin).search
        : trimmed;
    const inviteCode =
      extractAfter(path, "/play/i/") ?? extractAfter(trimmed, "/play/i/");
    if (inviteCode) return { kind: "invite", code: inviteCode };
    const playerToken =
      extractAfter(path, "/play/") ?? extractAfter(trimmed, "/play/");
    if (playerToken) return { kind: "playerToken", token: playerToken };
  } catch {
    /* bare token below */
  }

  if (/^[a-zA-Z0-9_-]{8,}$/.test(trimmed)) {
    return { kind: "playerToken", token: trimmed };
  }

  return null;
}

export function playHref(target: PlayLinkTarget): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  if (target.kind === "invite") {
    return `${base}/play/i/${target.code}`;
  }
  return `${base}/play/${target.token}`;
}
