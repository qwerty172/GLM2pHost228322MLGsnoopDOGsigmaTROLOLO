/** User-facing Russian labels for WebRTC connection types (no TURN/STUN jargon). */

export type IceConnectionKind = "relay" | "srflx" | "host";

export const ICE_CONNECTION_LABELS: Record<
  IceConnectionKind,
  { short: string; hint: string; tone: "good" | "ok" | "warn" }
> = {
  host: {
    short: "Прямое",
    hint: "Оптимальное соединение с хостом",
    tone: "good",
  },
  srflx: {
    short: "Через сеть",
    hint: "Соединение через интернет — обычная задержка",
    tone: "ok",
  },
  relay: {
    short: "Через сервер",
    hint: "Прямое соединение недоступно — возможна повышенная задержка. Проверь VPN и файрвол.",
    tone: "warn",
  },
};

export const ICE_TONE_STYLES: Record<
  "good" | "ok" | "warn",
  { border: string; color: string }
> = {
  good: { border: "#22c55e", color: "#86efac" },
  ok: { border: "#22c55e", color: "#86efac" },
  warn: { border: "#a855f7", color: "#c084fc" },
};
