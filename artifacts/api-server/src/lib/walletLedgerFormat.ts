/** Extract bare session UUID from ledger refId (handles renew suffix). */
export function sessionIdFromLedgerRef(refId: string | null | undefined): string | null {
  if (!refId) return null;
  const idx = refId.indexOf(":renew:");
  return idx === -1 ? refId : refId.slice(0, idx);
}

/** Map raw ledger kinds to wallet-history UI kinds. */
export function mapLedgerKindForWallet(kind: string): string {
  if (kind === "block_reserve") return "block_purchase";
  return kind;
}

/** Human-readable Russian label for block billing rows in wallet history. */
export function formatBlockReserveDescription(
  note: string | null | undefined,
  gameTitle: string | null | undefined,
  amountLzt: number,
): string {
  const gameSuffix = gameTitle ? ` — ${gameTitle}` : "";

  const renewMatch = note?.match(/block renew: \+(\d+) мин/);
  if (renewMatch) {
    return `Продление блока ${renewMatch[1]} мин${gameSuffix}`;
  }

  const minsMatch = note?.match(/block reserve: (\d+) мин/);
  if (minsMatch) {
    return `Блок ${minsMatch[1]} мин${gameSuffix}`;
  }

  if (note?.includes("block reserve")) {
    const abs = Math.abs(amountLzt);
    if (abs > 0) {
      return `Блок ${abs} LZT${gameSuffix}`;
    }
    return `Блок тариф${gameSuffix}`;
  }

  return note?.trim() || `Блок тариф${gameSuffix}`;
}
