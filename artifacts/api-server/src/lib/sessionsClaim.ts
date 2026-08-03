/** Block billing fields may only be set on the initial claim, not on reconnect. */
export function shouldApplyBlockOnClaim(
  isReclaimBySamePlayer: boolean,
  blockMinutes: number | null,
): boolean {
  return !isReclaimBySamePlayer && blockMinutes !== null;
}
