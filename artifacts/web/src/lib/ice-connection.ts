/** WebRTC ICE candidate type mapped to a small union for UI. */
export type IceConnectionKind = "relay" | "srflx" | "host";

export function mapCandidateType(candidateType: string): IceConnectionKind {
  if (candidateType === "relay") return "relay";
  if (candidateType === "srflx") return "srflx";
  return "host";
}

/** Player-facing label — без терминов TURN/STUN/WebRTC. */
export function iceConnectionPlayerLabel(kind: IceConnectionKind): string {
  switch (kind) {
    case "relay":
      return "Через сервер";
    case "srflx":
    case "host":
      return "Прямое";
  }
}

export function iceConnectionBadgeStyle(kind: IceConnectionKind): {
  borderColor: string;
  color: string;
} {
  if (kind === "relay") {
    return { borderColor: "#a855f7", color: "#c084fc" };
  }
  return { borderColor: "#22c55e", color: "#86efac" };
}

/** Подсказки при обрыве связи — для игрока. */
export const ICE_DISCONNECT_HINTS_PLAYER: readonly string[] = [
  "Проверьте интернет и отключите VPN, если он включён",
  "Файрвол или антивирус может блокировать UDP — попробуйте другую сеть",
  "Если проблема повторяется — выберите другого хоста",
];

/** Сеть WebRTC — для хоста (технические термины допустимы). */
export const ICE_HOST_TROUBLESHOOT_ITEMS: readonly string[] = [
  "Прямое P2P работает, если у обоих открыт UDP (без симметричного NAT)",
  "Если игрок не подключается — настройте TURN на сервере (TURN_URL в .env, см. .env.example)",
  "На ПК хоста разрешите исходящий UDP и порты агента 18080–18083 в файрволе",
  "Через TURN задержка выше — это нормально при строгом NAT",
];
