/** User-facing labels for WebRTC ICE connection types (no raw TURN/STUN/P2P in UI). */

export type IceConnectionType = "relay" | "srflx" | "host";

export function mapIceCandidateType(raw: string): IceConnectionType {
  if (raw === "relay") return "relay";
  if (raw === "srflx") return "srflx";
  return "host";
}

export function iceConnectionLabel(type: IceConnectionType): string {
  switch (type) {
    case "relay":
      return "Через сервер";
    case "srflx":
      return "Через NAT";
    case "host":
      return "Прямое";
  }
}

export function iceConnectionBadgeStyle(type: IceConnectionType): {
  borderColor: string;
  color: string;
} {
  switch (type) {
    case "relay":
      return { borderColor: "#a855f7", color: "#c084fc" };
    case "srflx":
      return { borderColor: "#eab308", color: "#fde047" };
    case "host":
      return { borderColor: "#22c55e", color: "#86efac" };
  }
}

/** Hint shown in the disconnect dock — explains what may help based on path type. */
export function iceDisconnectHint(type: IceConnectionType | null): string {
  if (type === "relay") {
    return "Связь шла через relay-сервер. Проверь интернет у себя и у хоста.";
  }
  if (type === "srflx") {
    return "Прямое соединение через NAT. Попробуй переподключиться или сменить сеть.";
  }
  return "Прямое соединение прервано. Нажми «Переподключить» или обнови страницу.";
}

export function iceReconnectMessage(): string {
  return "Восстанавливаем связь с хостом…";
}

/** Short note for hosts when player may need TURN (strict NAT). */
export function hostNatHint(): string {
  return "Если игрок не подключается — открой порты UDP или включи TURN в настройках сервера (.env TURN_URLS).";
}
