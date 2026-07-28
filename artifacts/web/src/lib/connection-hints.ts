/** User-facing labels for WebRTC connection path — no STUN/TURN jargon. */

export type IceConnectionKind = "relay" | "srflx" | "host";

export const ICE_KIND_LABELS: Record<IceConnectionKind, string> = {
  host: "Напрямую",
  srflx: "Через сеть",
  relay: "Через сервер",
};

export const ICE_KIND_HINTS: Record<IceConnectionKind, string> = {
  host: "Прямое соединение с хостом — минимальная задержка.",
  srflx: "Соединение через сеть — обычно стабильно.",
  relay:
    "Трафик идёт через промежуточный сервер — задержка может быть выше. Отключи VPN, если используешь.",
};

/** Short tips shown when the player loses connection. */
export function getDisconnectHints(iceType: IceConnectionKind | null): string[] {
  if (iceType === "relay") {
    return [
      "Соединение шло через сервер — попробуй другую сеть (например, мобильный интернет).",
      "Отключи VPN и переподключись.",
      "Проверь, что файрвол не блокирует браузер.",
    ];
  }
  return [
    "Проверь интернет и нажми «Переподключить».",
    "Отключи VPN, если он включён.",
    "Убедись, что файрвол не блокирует браузер.",
  ];
}
