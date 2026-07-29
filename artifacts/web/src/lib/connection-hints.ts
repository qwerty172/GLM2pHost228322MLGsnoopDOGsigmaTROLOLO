/** ICE candidate types surfaced in the player HUD (not raw TURN/STUN/P2P jargon). */
export type IceConnectionKind = "relay" | "srflx" | "host";

export const ICE_CONNECTION_LABELS: Record<IceConnectionKind, string> = {
  relay: "Через ретранслятор",
  srflx: "Через NAT",
  host: "Прямое",
};

export function getIceConnectionLabel(kind: IceConnectionKind): string {
  return ICE_CONNECTION_LABELS[kind];
}
