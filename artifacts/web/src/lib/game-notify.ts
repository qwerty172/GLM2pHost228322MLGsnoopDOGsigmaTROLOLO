export const GAME_NOTIFY_STORAGE_KEY = "streamline.gameNotify";
export const GAME_NOTIFY_CHANGED_EVENT = "game-notify-changed";

export interface GameNotifySubscription {
  slug: string;
  title: string;
  subscribedAt: string;
}

function parseSubscriptions(raw: string | null): GameNotifySubscription[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is GameNotifySubscription =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as GameNotifySubscription).slug === "string" &&
        typeof (item as GameNotifySubscription).title === "string",
    );
  } catch {
    return [];
  }
}

function notifyChanged(): void {
  window.dispatchEvent(new Event(GAME_NOTIFY_CHANGED_EVENT));
}

export function loadGameNotifySubscriptions(): GameNotifySubscription[] {
  return parseSubscriptions(localStorage.getItem(GAME_NOTIFY_STORAGE_KEY));
}

export function getSubscribedSlugs(): Set<string> {
  return new Set(loadGameNotifySubscriptions().map((s) => s.slug));
}

export function isGameNotifySubscribed(slug: string): boolean {
  return loadGameNotifySubscriptions().some((s) => s.slug === slug);
}

export function addGameNotifySubscription(sub: GameNotifySubscription): void {
  const existing = loadGameNotifySubscriptions().filter((s) => s.slug !== sub.slug);
  localStorage.setItem(
    GAME_NOTIFY_STORAGE_KEY,
    JSON.stringify([...existing, sub]),
  );
  notifyChanged();
}

export function removeGameNotifySubscription(slug: string): void {
  const next = loadGameNotifySubscriptions().filter((s) => s.slug !== slug);
  if (next.length === 0) {
    localStorage.removeItem(GAME_NOTIFY_STORAGE_KEY);
  } else {
    localStorage.setItem(GAME_NOTIFY_STORAGE_KEY, JSON.stringify(next));
  }
  notifyChanged();
}

export async function requestNotifyPermission(): Promise<
  NotificationPermission | "unsupported"
> {
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return Notification.requestPermission();
}

export function showGameOnlineNotification(title: string, slug: string): void {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") {
    return;
  }
  const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
  const n = new Notification(`${title} снова онлайн`, {
    body: "Появился хост — можно играть.",
    tag: `game-online:${slug}`,
    icon: `${base}/favicon.ico`,
  });
  n.onclick = () => {
    window.focus();
    window.location.href = `${base}/games/${encodeURIComponent(slug)}`;
    n.close();
  };
}
