export type QuotaFormFieldErrors = Partial<
  Record<
    | "title"
    | "royaltyValue"
    | "budgetLzt"
    | "sponsorHostPerMinute"
    | "sponsorPlayerPerMinute"
    | "minSessionMinutes"
    | "maxSessionMinutes"
    | "startAt"
    | "endAt"
    | "minGpuVram"
    | "minCpuCores"
    | "minRamGb"
    | "minDownloadMbps"
    | "minUploadMbps"
    | "recGpuVram"
    | "recCpuCores"
    | "recRamGb"
    | "recDownloadMbps"
    | "recUploadMbps",
    string
  >
>;

export type QuotaCreateFormInput = {
  kind: "royalty" | "sponsor";
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
};

export type QuotaEditFormInput = {
  kind: "royalty" | "sponsor";
  title: string;
  royaltyBasis?: "percent" | "fixed_per_minute" | null;
  royaltyValue: number;
  budgetLzt: number;
  sponsorHostPerMinute: number;
  sponsorPlayerPerMinute: number;
  minSessionMinutes: string;
  maxSessionMinutes: string;
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
};

type ValidationResult =
  | { ok: true; errors: QuotaFormFieldErrors }
  | { ok: false; errors: QuotaFormFieldErrors; firstError: string };

function parseOptionalPositiveInt(
  raw: string,
  label: string,
): { value: number | null; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { value: null };
  const n = Number(trimmed);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    return { value: null, error: `${label}: укажи целое число ≥ 1` };
  }
  return { value: n };
}

function parseOptionalSpecInt(
  raw: string,
  label: string,
): { value: number | null; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { value: null };
  const n = Number(trimmed);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    return { value: null, error: `${label}: укажи целое число ≥ 1` };
  }
  return { value: n };
}

function compareRecommended(
  errors: QuotaFormFieldErrors,
  minKey: keyof QuotaFormFieldErrors,
  recKey: keyof QuotaFormFieldErrors,
  minVal: number | null,
  recVal: number | null,
  label: string,
): void {
  if (minVal != null && recVal != null && recVal < minVal) {
    errors[recKey] = `Рекомендуемое ${label} должно быть не ниже минимального`;
  }
}

function validateSharedSpecs(
  input: {
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
  },
): QuotaFormFieldErrors {
  const errors: QuotaFormFieldErrors = {};

  const minGpu = parseOptionalSpecInt(input.minGpuVram, "Мин. VRAM");
  if (minGpu.error) errors.minGpuVram = minGpu.error;

  const minCpu = parseOptionalSpecInt(input.minCpuCores, "Мин. ядра CPU");
  if (minCpu.error) errors.minCpuCores = minCpu.error;

  const minRam = parseOptionalSpecInt(input.minRamGb, "Мин. RAM");
  if (minRam.error) errors.minRamGb = minRam.error;

  const minDown = parseOptionalSpecInt(input.minDownloadMbps, "Мин. download");
  if (minDown.error) errors.minDownloadMbps = minDown.error;

  const minUp = parseOptionalSpecInt(input.minUploadMbps, "Мин. upload");
  if (minUp.error) errors.minUploadMbps = minUp.error;

  const recGpu = parseOptionalSpecInt(input.recGpuVram, "Рек. VRAM");
  if (recGpu.error) errors.recGpuVram = recGpu.error;

  const recCpu = parseOptionalSpecInt(input.recCpuCores, "Рек. ядра CPU");
  if (recCpu.error) errors.recCpuCores = recCpu.error;

  const recRam = parseOptionalSpecInt(input.recRamGb, "Рек. RAM");
  if (recRam.error) errors.recRamGb = recRam.error;

  const recDown = parseOptionalSpecInt(input.recDownloadMbps, "Рек. download");
  if (recDown.error) errors.recDownloadMbps = recDown.error;

  const recUp = parseOptionalSpecInt(input.recUploadMbps, "Рек. upload");
  if (recUp.error) errors.recUploadMbps = recUp.error;

  compareRecommended(errors, "minGpuVram", "recGpuVram", minGpu.value, recGpu.value, "VRAM");
  compareRecommended(errors, "minCpuCores", "recCpuCores", minCpu.value, recCpu.value, "ядра CPU");
  compareRecommended(errors, "minRamGb", "recRamGb", minRam.value, recRam.value, "RAM");
  compareRecommended(
    errors,
    "minDownloadMbps",
    "recDownloadMbps",
    minDown.value,
    recDown.value,
    "download",
  );
  compareRecommended(
    errors,
    "minUploadMbps",
    "recUploadMbps",
    minUp.value,
    recUp.value,
    "upload",
  );

  return errors;
}

function validateSessionWindow(
  input: {
    minSessionMinutes: string;
    maxSessionMinutes: string;
    startAt?: string;
    endAt?: string;
  },
): QuotaFormFieldErrors {
  const errors: QuotaFormFieldErrors = {};

  const minMins = parseOptionalPositiveInt(input.minSessionMinutes, "Мин. длина сессии");
  if (minMins.error) errors.minSessionMinutes = minMins.error;

  const maxMins = parseOptionalPositiveInt(input.maxSessionMinutes, "Макс. длина сессии");
  if (maxMins.error) errors.maxSessionMinutes = maxMins.error;

  if (
    minMins.value != null &&
    maxMins.value != null &&
    maxMins.value < minMins.value
  ) {
    errors.maxSessionMinutes =
      "Максимальная длина сессии не может быть меньше минимальной";
  }

  const startRaw = input.startAt?.trim() ?? "";
  const endRaw = input.endAt?.trim() ?? "";

  if (startRaw && endRaw) {
    const start = new Date(startRaw);
    const end = new Date(endRaw);
    if (Number.isNaN(start.getTime())) {
      errors.startAt = "Некорректная дата начала";
    } else if (Number.isNaN(end.getTime())) {
      errors.endAt = "Некорректная дата окончания";
    } else if (end <= start) {
      errors.endAt = "Дата окончания должна быть позже даты начала";
    }
  } else if (endRaw && !startRaw) {
    const end = new Date(endRaw);
    if (Number.isNaN(end.getTime())) {
      errors.endAt = "Некорректная дата окончания";
    }
  }

  return errors;
}

function validateRoyaltyFields(
  royaltyBasis: "percent" | "fixed_per_minute",
  royaltyValue: number,
): QuotaFormFieldErrors {
  const errors: QuotaFormFieldErrors = {};
  if (!Number.isFinite(royaltyValue) || !Number.isInteger(royaltyValue) || royaltyValue < 0) {
    errors.royaltyValue = "Укажи неотрицательное целое число";
    return errors;
  }
  if (royaltyBasis === "percent" && royaltyValue > 100) {
    errors.royaltyValue = "Процент роялти — от 0 до 100";
  }
  return errors;
}

function validateSponsorFields(
  budgetLzt: number,
  sponsorHostPerMinute: number,
  sponsorPlayerPerMinute: number,
): QuotaFormFieldErrors {
  const errors: QuotaFormFieldErrors = {};

  if (!Number.isFinite(budgetLzt) || !Number.isInteger(budgetLzt) || budgetLzt <= 0) {
    errors.budgetLzt = "Бюджет должен быть положительным целым числом (LZT)";
  }

  const hostAdd = sponsorHostPerMinute;
  const playerAdd = sponsorPlayerPerMinute;

  if (
    !Number.isFinite(hostAdd) ||
    !Number.isInteger(hostAdd) ||
    hostAdd < 0
  ) {
    errors.sponsorHostPerMinute = "Доплата хосту — неотрицательное целое число";
  }

  if (
    !Number.isFinite(playerAdd) ||
    !Number.isInteger(playerAdd) ||
    playerAdd < 0
  ) {
    errors.sponsorPlayerPerMinute = "Доплата игроку — неотрицательное целое число";
  }

  if (
    !errors.sponsorHostPerMinute &&
    !errors.sponsorPlayerPerMinute &&
    hostAdd === 0 &&
    playerAdd === 0
  ) {
    errors.sponsorHostPerMinute =
      "Укажи доплату хосту или игроку — хотя бы одна должна быть > 0";
  }

  return errors;
}

function finalize(errors: QuotaFormFieldErrors): ValidationResult {
  const firstKey = Object.keys(errors)[0] as keyof QuotaFormFieldErrors | undefined;
  if (!firstKey) return { ok: true, errors };
  return { ok: false, errors, firstError: errors[firstKey]! };
}

export function validateQuotaCreateForm(input: QuotaCreateFormInput): ValidationResult {
  const errors: QuotaFormFieldErrors = {};

  if (!input.title.trim()) {
    errors.title = "Укажи название квоты";
  }

  if (input.kind === "royalty") {
    Object.assign(
      errors,
      validateRoyaltyFields(input.royaltyBasis, Math.floor(input.royaltyValue)),
    );
  } else {
    Object.assign(
      errors,
      validateSponsorFields(
        Math.floor(input.budgetLzt),
        Math.floor(input.sponsorHostPerMinute),
        Math.floor(input.sponsorPlayerPerMinute),
      ),
    );
  }

  Object.assign(errors, validateSessionWindow(input));
  Object.assign(errors, validateSharedSpecs(input));

  return finalize(errors);
}

export function validateQuotaEditForm(input: QuotaEditFormInput): ValidationResult {
  const errors: QuotaFormFieldErrors = {};

  if (!input.title.trim()) {
    errors.title = "Укажи название квоты";
  }

  if (input.kind === "royalty") {
    const basis =
      input.royaltyBasis === "fixed_per_minute" ? "fixed_per_minute" : "percent";
    Object.assign(
      errors,
      validateRoyaltyFields(basis, Math.floor(input.royaltyValue)),
    );
  } else {
    Object.assign(
      errors,
      validateSponsorFields(
        Math.floor(input.budgetLzt),
        Math.floor(input.sponsorHostPerMinute),
        Math.floor(input.sponsorPlayerPerMinute),
      ),
    );
  }

  Object.assign(
    errors,
    validateSessionWindow({
      minSessionMinutes: input.minSessionMinutes,
      maxSessionMinutes: input.maxSessionMinutes,
      endAt: input.endAt,
    }),
  );
  Object.assign(errors, validateSharedSpecs(input));

  return finalize(errors);
}

export function clearQuotaFieldError(
  errors: QuotaFormFieldErrors,
  field: keyof QuotaFormFieldErrors,
): QuotaFormFieldErrors {
  if (!errors[field]) return errors;
  const next = { ...errors };
  delete next[field];
  return next;
}
