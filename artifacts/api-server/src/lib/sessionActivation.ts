/** Roles that must both be present before a session is billed. */
export type SignalingRole = "host" | "player";

/**
 * Billing should only start once both sides are in the signaling room.
 * Player-only activation wrongly bills embed sessions (host agent never
 * auto-joins) and regular sessions where the player reconnects before the host.
 */
export function shouldActivateSession(
  peers: Iterable<{ role: SignalingRole }>,
): boolean {
  let hasHost = false;
  let hasPlayer = false;
  for (const peer of peers) {
    if (peer.role === "host") hasHost = true;
    if (peer.role === "player") hasPlayer = true;
    if (hasHost && hasPlayer) return true;
  }
  return false;
}
