export type QuotaKind = "royalty" | "sponsor";

export type QuotaFormErrors = Record<string, string>;

export interface QuotaFormValues {
  kind: QuotaKind;
  title: string;
  royaltyBasis: "percent" | "fixed_per_minute";
  royaltyValue: number;
  royaltySource: "player" | "host_share";
  budgetLzt: number;
  sponsorHostPerMinute: number;
  sponsorPlayerPerMinute: number;
  minSessionMinutes: string;
  maxSessionMinutes: string;
  startAt: string;
  endAt: string;
  minGpuVram: string;
  minCpuCores: string;
  minRamGb: string;
  minDownloadMbps: string;
  minUploadMbps: string;
  recGpuVram: string;
  recCpuCores: string;
  recRamGb: string;
  recDownloadMbps: string;
  recUploadMbps: string;
}

function parsePositiveInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return null;
  return n;
}

function parsePositiveIntStrict(raw: string): number | null {
  const n = parsePositiveInt(raw);
  if (n === null || n <= 0) return null;
  return n;
}

export function validateQuotaForm(values: QuotaFormValues): QuotaFormErrors {
  const errors: QuotaFormErrors = {};

  if (!values.title.trim()) {
    errors.title = "Укажи название квоты";
  } else if (values.title.trim().length > 120) {
    errors.title = "Название не длиннее 120 символов";
  }

  if (values.kind === "royalty") {
    if (values.royaltyValue < 0 || !Number.isInteger(values.royaltyValue)) {
      errors.royaltyValue = "Роялти — целое неотрицательное число";
    } else if (
      values.royaltyBasis === "percent" &&
      (values.royaltyValue < 0 || values.royaltyValue > 100)
    ) {
      errors.royaltyValue = "Процент роялти — от 0 до 100";
    }
  } else {
    if (!Number.isInteger(values.budgetLzt) || values.budgetLzt <= 0) {
      errors.budgetLzt = "Бюджет спонсора — целое число больше 0 LZT";
    }
    const hostAdd = values.sponsorHostPerMinute;
    const playerAdd = values.sponsorPlayerPerMinute;
    if (hostAdd < 0 || playerAdd < 0) {
      errors.sponsorHostPerMinute = "Выплаты за минуту не могут быть отрицательными";
    } else if (hostAdd === 0 && playerAdd === 0) {
      errors.sponsorHostPerMinute =
        "Укажи выплату хосту и/или игроку за минуту (хотя бы одну > 0)";
    }
  }

  const minSess = values.minSessionMinutes.trim()
    ? parsePositiveIntStrict(values.minSessionMinutes)
    : null;
  const maxSess = values.maxSessionMinutes.trim()
    ? parsePositiveIntStrict(values.maxSessionMinutes)
    : null;

  if (values.minSessionMinutes.trim() && minSess === null) {
    errors.minSessionMinutes = "Мин. длительность — целое число минут ≥ 1";
  }
  if (values.maxSessionMinutes.trim() && maxSess === null) {
    errors.maxSessionMinutes = "Макс. длительность — целое число минут ≥ 1";
  }
  if (minSess !== null && maxSess !== null && minSess > maxSess) {
    errors.maxSessionMinutes = "Макс. длительность не может быть меньше минимальной";
  }

  if (values.startAt && values.endAt) {
    const start = new Date(values.startAt);
    const end = new Date(values.endAt);
    if (Number.isNaN(start.getTime())) {
      errors.startAt = "Некорректная дата начала";
    } else if (Number.isNaN(end.getTime())) {
      errors.endAt = "Некорректная дата окончания";
    } else if (end <= start) {
      errors.endAt = "Дата окончания должна быть позже начала";
    }
  }

  const specFields: { key: keyof QuotaFormValues; label: string }[] = [
    { key: "minGpuVram", label: "Мин. VRAM" },
    { key: "minCpuCores", label: "Мин. ядра CPU" },
    { key: "minRamGb", label: "Мин. RAM" },
    { key: "minDownloadMbps", label: "Мин. download" },
    { key: "minUploadMbps", label: "Мин. upload" },
    { key: "recGpuVram", label: "Рек. VRAM" },
    { key: "recCpuCores", label: "Рек. ядра CPU" },
    { key: "recRamGb", label: "Рек. RAM" },
    { key: "recDownloadMbps", label: "Рек. download" },
    { key: "recUploadMbps", label: "Рек. upload" },
  ];

  for (const { key, label } of specFields) {
    const raw = values[key];
    if (typeof raw === "string" && raw.trim() && parsePositiveInt(raw) === null) {
      errors[key] = `${label} — целое неотрицательное число`;
    }
  }

  const minGpu = parsePositiveInt(values.minGpuVram);
  const recGpu = parsePositiveInt(values.recGpuVram);
  if (minGpu !== null && recGpu !== null && recGpu < minGpu) {
    errors.recGpuVram = "Рекомендуемая VRAM не может быть меньше минимальной";
  }

  const minCpu = parsePositiveInt(values.minCpuCores);
  const recCpu = parsePositiveInt(values.recCpuCores);
  if (minCpu !== null && recCpu !== null && recCpu < minCpu) {
    errors.recCpuCores = "Рекомендуемые ядра CPU не могут быть меньше минимальных";
  }

  const minRam = parsePositiveInt(values.minRamGb);
  const recRam = parsePositiveInt(values.recRamGb);
  if (minRam !== null && recRam !== null && recRam < minRam) {
    errors.recRamGb = "Рекомендуемая RAM не может быть меньше минимальной";
  }

  return errors;
}

export function firstQuotaFormError(errors: QuotaFormErrors): string | null {
  const first = Object.values(errors)[0];
  return first ?? null;
}
