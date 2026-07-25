/** Session playerToken stored after join-code exchange (not in the URL). */
export const SESSION_PLAYER_TOKEN_KEY = "streamline.sessionPlayerToken";

const JOIN_CODE_RE = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]+$/i;

export function isJoinCodeSlug(slug: string): boolean {
  return slug.length <= 12 && JOIN_CODE_RE.test(slug);
}

export function playJoinPath(slug: string): string {
  const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
  return `${base}/play/${slug}`;
}

export async function resolvePlaySlug(slug: string): Promise<string> {
  if (isJoinCodeSlug(slug)) {
    const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
    const resp = await fetch(
      `${base}/api/join-codes/${encodeURIComponent(slug.toUpperCase())}/exchange`,
      { method: "POST" },
    );
    if (!resp.ok) throw new Error("join code invalid");
    const data = (await resp.json()) as { playerToken: string };
    return data.playerToken;
  }
  return slug;
}

export function stripTokenFromPlayUrl(): void {
  const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
  const qs = window.location.search;
  window.history.replaceState(null, "", `${base}/play${qs}`);
}
