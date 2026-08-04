/**
 * Guards game-exit auto-teardown so a stale exit event from a prior session
 * cannot PATCH /end for a newer active session.
 */
export function shouldEndSessionOnGameExit(
  registeredSessionId: string | null | undefined,
  currentSessionId: string | null | undefined,
): boolean {
  const reg = registeredSessionId?.trim();
  const cur = currentSessionId?.trim();
  return Boolean(reg && cur && reg === cur);
}
