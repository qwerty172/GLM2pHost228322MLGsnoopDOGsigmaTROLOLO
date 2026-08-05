export function fmtLzt(n: number | null | undefined): string {
  return n == null ? "—" : new Intl.NumberFormat("ru-RU").format(n) + " LZT";
}

export function quotaKindLabel(kind: string): string {
  return kind === "royalty" ? "Роялти" : "Спонсор";
}

export function quotaKindAccentColor(kind: string): string {
  return kind === "royalty" ? "#fbbf24" : "#38bdf8";
}

export function formatRoyaltyRate(
  royaltyBasis: string | null | undefined,
  royaltyValue: number | null | undefined,
): string {
  if (royaltyBasis === "percent") {
    return `${royaltyValue ?? 0}% / мин`;
  }
  return `${royaltyValue ?? 0} LZT/мин`;
}

export function formatRoyaltySource(
  royaltySource: string | null | undefined,
): string {
  return royaltySource === "player" ? "Сверху с игрока" : "Из доли хоста";
}

export function formatQuotaDescription(
  description: string | null | undefined,
): string {
  return description || "Без описания";
}

export function formatMovementKind(kind: string): string {
  return kind.replace("quota_", "");
}

export function isQuotaCloseable(status: string): boolean {
  return !["closed", "expired"].includes(status);
}

export function getCloseButtonLabel(confirmingClose: boolean): string {
  return confirmingClose ? "Подтвердить закрытие" : "Закрыть";
}
