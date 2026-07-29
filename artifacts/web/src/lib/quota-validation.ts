export type QuotaFormValues = {
  kind: "royalty" | "sponsor";
  title: string;
  royaltyBasis?: "percent" | "fixed_per_minute";
  royaltyValue?: number;
  royaltySource?: "player" | "host_share";
  budgetLzt?: number;
  sponsorHostPerMinuteLzt?: number;
  sponsorPlayerPerMinuteLzt?: number;
  minSessionMinutes?: string | number | null;
  maxSessionMinutes?: string | number | null;
  startAt?: string;
  endAt?: string;
  minGpuVram?: string | number | null;
  minCpuCores?: string | number | null;
  minRamGb?: string | number | null;
  recGpuVram?: string | number | null;
  recCpuCores?: string | number | null;
  recRamGb?: string | number | null;
};

function parseOptionalInt(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.floor(n);
}

function assertRecGteMin(
  label: string,
  min: number | null,
  rec: number | null,
): string | null {
  if (min != null && rec != null && rec < min) {
    return `Рекомендуемое значение «${label}» не может быть меньше минимального`;
  }
  return null;
}

/** Client-side quota form validation with Russian messages (mirrors API rules). */
export function validateQuotaForm(values: QuotaFormValues): string | null {
  if (!values.title.trim()) {
    return "Укажи название квоты";
  }

  if (values.kind === "royalty") {
    if (values.royaltyBasis !== "percent" && values.royaltyBasis !== "fixed_per_minute") {
      return "Укажи тип роялти: процент или фикс за минуту";
    }
    if (values.royaltyValue == null || values.royaltyValue < 0) {
      return "Роялти не может быть отрицательным";
    }
    if (values.royaltyBasis === "percent" && values.royaltyValue > 100) {
      return "Процент роялти — от 0 до 100";
    }
    if (values.royaltySource !== "player" && values.royaltySource !== "host_share") {
      return "Укажи источник роялти: с игрока или с доли хоста";
    }
  }

  if (values.kind === "sponsor") {
    if (values.budgetLzt == null || values.budgetLzt <= 0) {
      return "Бюджет спонсора должен быть больше нуля";
    }
    const hostAdd = values.sponsorHostPerMinuteLzt ?? 0;
    const playerAdd = values.sponsorPlayerPerMinuteLzt ?? 0;
    if (hostAdd < 0 || playerAdd < 0) {
      return "Доплаты за минуту не могут быть отрицательными";
    }
    if (hostAdd === 0 && playerAdd === 0) {
      return "Спонсор должен доплачивать хосту или игроку за минуту";
    }
  }

  const minSess = parseOptionalInt(values.minSessionMinutes);
  const maxSess = parseOptionalInt(values.maxSessionMinutes);
  if (minSess != null && minSess < 1) {
    return "Минимальная длина сессии — не меньше 1 минуты";
  }
  if (maxSess != null && maxSess < 1) {
    return "Максимальная длина сессии — не меньше 1 минуты";
  }
  if (minSess != null && maxSess != null && minSess > maxSess) {
    return "Минимальная длина сессии не может быть больше максимальной";
  }

  if (values.startAt && values.endAt) {
    const start = new Date(values.startAt);
    const end = new Date(values.endAt);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start >= end) {
      return "Дата начала должна быть раньше даты окончания";
    }
  }

  const specChecks = [
    assertRecGteMin("VRAM GPU", parseOptionalInt(values.minGpuVram), parseOptionalInt(values.recGpuVram)),
    assertRecGteMin("ядра CPU", parseOptionalInt(values.minCpuCores), parseOptionalInt(values.recCpuCores)),
    assertRecGteMin("ОЗУ", parseOptionalInt(values.minRamGb), parseOptionalInt(values.recRamGb)),
  ];
  for (const err of specChecks) {
    if (err) return err;
  }

  return null;
}
