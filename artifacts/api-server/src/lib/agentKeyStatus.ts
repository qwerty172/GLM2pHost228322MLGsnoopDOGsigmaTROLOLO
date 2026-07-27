/** Agent Ed25519 key binding state reported to the desktop agent. */
export type AgentKeyStatus = "ok" | "revoked" | "unbound" | "mismatch";

/**
 * Compare the server's bound pubkey with the agent's local pubkey.
 * - ok: same key bound
 * - revoked: server cleared the key (agent still has a local key)
 * - mismatch: a different key is bound on the server
 * - unbound: agent did not send a pubkey
 */
export function resolveAgentKeyStatus(
  serverPubkey: string | null | undefined,
  clientPubkey: string | null | undefined,
): AgentKeyStatus {
  const client = (clientPubkey ?? "").trim().toLowerCase();
  if (!client) return "unbound";

  const server = (serverPubkey ?? "").trim().toLowerCase();
  if (!server) return "revoked";
  if (server === client) return "ok";
  return "mismatch";
}
