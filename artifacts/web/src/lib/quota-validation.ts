export type QuotaKind = "royalty" | "sponsor";

export interface QuotaFormInput {
  kind: QuotaKind;
  title: string;
  royaltyBasis?: "percent" | "fixed_per_minute" | null;
  royaltyValue?: number | null;
  royaltySource?: "player" | "host_share" | null;
  budgetLzt?: number | null;
  sponsorHostPerMinuteLzt?: number | null;
  sponsorPlayerPerMinuteLzt?: number | null;
  minSessionMinutes?: number | null;
  maxSessionMinutes?: number | null;
  startAt?: string | null;
  endAt?: string | null;
  minGpuVram?: number | null;
  minCpuCores?: number | null;
  minRamGb?: number | null;
  minDownloadMbps?: number | null;
  minUploadMbps?: number | null;
  recGpuVram?: number | null;
  recCpuCores?: number | null;
  recRamGb?: number | null;
  recDownloadMbps?: number | null;
  recUploadMbps?: number | null;
}

function parseOptionalInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return NaN;
  return n;
}

/** Parse form string fields before submit — returns NaN marker for invalid integers. */
export function parseQuotaIntField(raw: string): number | null {
  return parseOptionalInt(raw);
}

function assertNonNegativeInt(
  value: number | null | undefined,
  label: string,
): string | null {
  if (value == null) return null;
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    return `${label} должно быть целым числом ≥ 0`;
  }
  return null;
}

function assertRecGteMin(
  min: number | null | undefined,
  rec: number | null | undefined,
  label: string,
): string | null {
  if (min == null || rec == null) return null;
  if (rec < min) {
    return `Рекомендуемое значение «${label}» не может быть меньше минимального`;
  }
  return null;
}

/** Client-side validation mirroring api-server quotas route rules. Returns Russian error or null. */
export function validateQuotaForm(input: QuotaFormInput): string | null {
  if (!input.title.trim()) {
    return "Укажи название квоты";
  }

  if (input.kind === "royalty") {
    if (
      input.royaltyBasis !== "percent" &&
      input.royaltyBasis !== "fixed_per_minute"
    ) {
      return "Выбери тип роялти: процент или фикс за минуту";
    }
    if (input.royaltyValue == null || input.royaltyValue < 0) {
      return "Укажи неотрицательное значение роялти";
    }
    if (input.royaltyBasis === "percent" && input.royaltyValue > 100) {
      return "Процент роялти должен быть от 0 до 100";
    }
    if (
      input.royaltySource !== "player" &&
      input.royaltySource !== "host_share"
    ) {
      return "Укажи источник роялти: игрок или доля хоста";
    }
  } else {
    if (input.budgetLzt == null || input.budgetLzt <= 0) {
      return "Бюджет спонсорской квоты должен быть положительным";
    }
    const hostAdd = input.sponsorHostPerMinuteLzt ?? 0;
    const playerAdd = input.sponsorPlayerPerMinuteLzt ?? 0;
    if (hostAdd < 0 || playerAdd < 0) {
      return "Выплаты за минуту не могут быть отрицательными";
    }
    if (hostAdd === 0 && playerAdd === 0) {
      return "Спонсорская квота должна платить хосту или игроку за минуту";
    }
  }

  if (
    input.minSessionMinutes != null &&
    input.maxSessionMinutes != null &&
    input.minSessionMinutes > input.maxSessionMinutes
  ) {
    return "Минимальная длительность сессии не может превышать максимальную";
  }

  if (input.startAt && input.endAt) {
    const start = new Date(input.startAt).getTime();
    const end = new Date(input.endAt).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      return "Некорректные даты начала или окончания";
    }
    if (start >= end) {
      return "Дата окончания должна быть позже даты начала";
    }
  }

  const specFields: Array<{
    min: number | null | undefined;
    rec: number | null | undefined;
    label: string;
  }> = [
    { min: input.minGpuVram, rec: input.recGpuVram, label: "VRAM GPU" },
    { min: input.minCpuCores, rec: input.recCpuCores, label: "ядра CPU" },
    { min: input.minRamGb, rec: input.recRamGb, label: "ОЗУ" },
    {
      min: input.minDownloadMbps,
      rec: input.recDownloadMbps,
      label: "скорость скачивания",
    },
    {
      min: input.minUploadMbps,
      rec: input.recUploadMbps,
      label: "скорость отдачи",
    },
  ];

  for (const { min, rec, label } of specFields) {
    const minErr = assertNonNegativeInt(min, `Минимальное «${label}»`);
    if (minErr) return minErr;
    const recErr = assertNonNegativeInt(rec, `Рекомендуемое «${label}»`);
    if (recErr) return recErr;
    const orderErr = assertRecGteMin(min, rec, label);
    if (orderErr) return orderErr;
  }

  return null;
}
