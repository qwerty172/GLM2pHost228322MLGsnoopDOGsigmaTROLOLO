export type QuotaKind = "royalty" | "sponsor";

export type QuotaFormInput = {
  kind: QuotaKind;
  title: string;
  royaltyBasis?: "percent" | "fixed_per_minute" | null;
  royaltyValue?: number | null;
  royaltySource?: "player" | "host_share" | null;
  budgetLzt?: number | null;
  sponsorHostPerMinute?: number | null;
  sponsorPlayerPerMinute?: number | null;
  minSessionMinutes?: number | null;
  maxSessionMinutes?: number | null;
  startAt?: string | Date | null;
  endAt?: string | Date | null;
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
};

function parseOptionalDate(value: string | Date | null | undefined): Date | null {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return Math.floor(n);
}

/** Parses optional numeric form fields; returns null for empty input. */
export function parseQuotaIntField(value: string): number | null {
  return parseOptionalInt(value);
}

/** Client-side validation mirroring API rules in routes/quotas.ts. */
export function validateQuotaForm(input: QuotaFormInput): string | null {
  if (!input.title.trim()) {
    return "Укажи название";
  }

  if (input.kind === "royalty") {
    const value = input.royaltyValue;
    if (value == null || value < 0 || !Number.isInteger(value)) {
      return "Значение роялти должно быть целым неотрицательным числом";
    }
    if (input.royaltyBasis === "percent" && value > 100) {
      return "Процент роялти должен быть от 0 до 100";
    }
    if (
      input.royaltySource !== "player" &&
      input.royaltySource !== "host_share"
    ) {
      return "Укажи источник роялти: игрок или доля хоста";
    }
  } else {
    const budget = input.budgetLzt;
    if (budget == null || budget <= 0 || !Number.isInteger(budget)) {
      return "Бюджет спонсорской квоты должен быть положительным целым числом LZT";
    }
    const host = input.sponsorHostPerMinute ?? 0;
    const player = input.sponsorPlayerPerMinute ?? 0;
    if (host < 0 || player < 0) {
      return "Ставки за минуту не могут быть отрицательными";
    }
    if (host === 0 && player === 0) {
      return "Укажи выплату хосту и/или игроку за минуту (хотя бы одну больше 0)";
    }
  }

  const minSession = input.minSessionMinutes;
  const maxSession = input.maxSessionMinutes;
  if (minSession != null && minSession < 1) {
    return "Минимальная длительность сессии — не меньше 1 минуты";
  }
  if (maxSession != null && maxSession < 1) {
    return "Максимальная длительность сессии — не меньше 1 минуты";
  }
  if (
    minSession != null &&
    maxSession != null &&
    minSession > maxSession
  ) {
    return "Минимальная длительность не может быть больше максимальной";
  }

  const startAt = parseOptionalDate(input.startAt);
  const endAt = parseOptionalDate(input.endAt);
  if (startAt && endAt && startAt >= endAt) {
    return "Дата начала должна быть раньше даты окончания";
  }

  const specPairs: Array<{
    label: string;
    min: number | null | undefined;
    rec: number | null | undefined;
  }> = [
    { label: "VRAM GPU", min: input.minGpuVram, rec: input.recGpuVram },
    { label: "ядер CPU", min: input.minCpuCores, rec: input.recCpuCores },
    { label: "ОЗУ (ГБ)", min: input.minRamGb, rec: input.recRamGb },
    {
      label: "скорости скачивания",
      min: input.minDownloadMbps,
      rec: input.recDownloadMbps,
    },
    {
      label: "скорости аплоада",
      min: input.minUploadMbps,
      rec: input.recUploadMbps,
    },
  ];

  for (const { label, min, rec } of specPairs) {
    if (min != null && min < 0) {
      return `Минимальные требования по ${label} не могут быть отрицательными`;
    }
    if (rec != null && rec < 0) {
      return `Рекомендуемые требования по ${label} не могут быть отрицательными`;
    }
    if (min != null && rec != null && rec < min) {
      return `Рекомендуемые требования по ${label} должны быть не ниже минимальных`;
    }
  }

  return null;
}
