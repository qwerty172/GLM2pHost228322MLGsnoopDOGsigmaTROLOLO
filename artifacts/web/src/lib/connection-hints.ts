/** ICE candidate type as reported by WebRTC stats. */
export type IceConnectionType = "relay" | "srflx" | "host";

/** Short badge label for the player HUD (no TURN/STUN jargon). */
export const ICE_CONNECTION_SHORT_LABELS: Record<IceConnectionType, string> = {
  relay: "Ретрансляция",
  srflx: "Через NAT",
  host: "Прямое",
};

/** Tooltip / aria description for connection quality badge. */
export const ICE_CONNECTION_HINTS: Record<IceConnectionType, string> = {
  relay: "Трафик идёт через сервер ретрансляции (медленнее, но стабильнее за NAT)",
  srflx: "Публичный адрес получен через STUN — прямое соединение через NAT",
  host: "Прямое P2P-соединение между игроком и хостом",
};

export function iceConnectionShortLabel(type: IceConnectionType): string {
  return ICE_CONNECTION_SHORT_LABELS[type];
}

export function iceConnectionHint(type: IceConnectionType): string {
  return ICE_CONNECTION_HINTS[type];
}
