import type { Quota } from "@workspace/api-client-react";

/** Mirrors api-server hostTier.ts — kept in sync for quota list UX. */
const STREAM_OVERHEAD = {
  cpuCores: 2,
  ramGb: 2,
  gpuVram: 0,
  uploadMbps: 5,
  downloadMbps: 0,
} as const;

type HostSpecsInput = {
  gpuVram: number | null;
  cpuCores: number | null;
  ramGb: number | null;
  downloadMbps: number | null;
  uploadMbps: number | null;
};

type TierThresholds = {
  gpuVram?: number | null;
  cpuCores?: number | null;
  ramGb?: number | null;
  downloadMbps?: number | null;
  uploadMbps?: number | null;
};

export type QuotaHostTier = "below_min" | "meets_min" | "above_rec";

export type QuotaCompatibility = {
  tier: QuotaHostTier;
  compatible: boolean;
  reason: string | null;
};

function parseGpuVram(gpuName: string | null | undefined): number | null {
  if (!gpuName) return null;
  const m = gpuName.match(/(\d+)\s*GB/i);
  return m ? parseInt(m[1], 10) : null;
}

export function specsFromPcSpecs(
  pcSpecs: {
    gpu: string;
    ramGb: number;
    cpuCores?: number;
    downloadMbps?: number;
    uploadMbps?: number;
  } | null | undefined,
): HostSpecsInput {
  if (!pcSpecs) {
    return {
      gpuVram: null,
      cpuCores: null,
      ramGb: null,
      downloadMbps: null,
      uploadMbps: null,
    };
  }
  return {
    gpuVram: parseGpuVram(pcSpecs.gpu),
    cpuCores: pcSpecs.cpuCores ?? null,
    ramGb: pcSpecs.ramGb,
    downloadMbps: pcSpecs.downloadMbps ?? null,
    uploadMbps: pcSpecs.uploadMbps ?? null,
  };
}

function clearsAll(
  specs: HostSpecsInput,
  thresholds: TierThresholds,
): boolean {
  const checks: Array<[keyof HostSpecsInput, keyof typeof STREAM_OVERHEAD]> = [
    ["gpuVram", "gpuVram"],
    ["cpuCores", "cpuCores"],
    ["ramGb", "ramGb"],
    ["downloadMbps", "downloadMbps"],
    ["uploadMbps", "uploadMbps"],
  ];
  for (const [specKey, overheadKey] of checks) {
    const threshold = thresholds[specKey];
    if (threshold == null) continue;
    const hostValue = specs[specKey];
    if (hostValue == null) continue;
    if (hostValue < threshold + STREAM_OVERHEAD[overheadKey]) return false;
  }
  return true;
}

export function computeQuotaHostTier(
  specs: HostSpecsInput,
  quota: Pick<
    Quota,
    | "minGpuVram"
    | "minCpuCores"
    | "minRamGb"
    | "minDownloadMbps"
    | "minUploadMbps"
    | "recGpuVram"
    | "recCpuCores"
    | "recRamGb"
    | "recDownloadMbps"
    | "recUploadMbps"
  >,
): QuotaHostTier {
  const minThresholds = {
    gpuVram: quota.minGpuVram,
    cpuCores: quota.minCpuCores,
    ramGb: quota.minRamGb,
    downloadMbps: quota.minDownloadMbps,
    uploadMbps: quota.minUploadMbps,
  };
  const recThresholds = {
    gpuVram: quota.recGpuVram,
    cpuCores: quota.recCpuCores,
    ramGb: quota.recRamGb,
    downloadMbps: quota.recDownloadMbps,
    uploadMbps: quota.recUploadMbps,
  };
  if (!clearsAll(specs, minThresholds)) return "below_min";
  if (!clearsAll(specs, recThresholds)) return "meets_min";
  return "above_rec";
}

function firstFailureReason(
  specs: HostSpecsInput,
  thresholds: TierThresholds,
): string | null {
  const labels: Record<keyof HostSpecsInput, string> = {
    gpuVram: "VRAM",
    cpuCores: "ядер CPU",
    ramGb: "ГБ RAM",
    downloadMbps: "Мбит/с скачивания",
    uploadMbps: "Мбит/с отдачи",
  };
  const checks: Array<[keyof HostSpecsInput, keyof typeof STREAM_OVERHEAD]> = [
    ["gpuVram", "gpuVram"],
    ["cpuCores", "cpuCores"],
    ["ramGb", "ramGb"],
    ["downloadMbps", "downloadMbps"],
    ["uploadMbps", "uploadMbps"],
  ];
  for (const [specKey, overheadKey] of checks) {
    const threshold = thresholds[specKey];
    if (threshold == null) continue;
    const hostValue = specs[specKey];
    if (hostValue == null) continue;
    const required = threshold + STREAM_OVERHEAD[overheadKey];
    if (hostValue < required) {
      const have =
        specKey === "gpuVram"
          ? `${hostValue} ГБ VRAM`
          : specKey === "cpuCores"
            ? `${hostValue} ядер`
            : specKey === "ramGb"
              ? `${hostValue} ГБ RAM`
              : `${hostValue} Мбит/с`;
      return `Нужно ${required}+ ${labels[specKey]}, у тебя ${have}`;
    }
  }
  return null;
}

export function getQuotaCompatibility(
  pcSpecs: Parameters<typeof specsFromPcSpecs>[0],
  quota: Quota,
): QuotaCompatibility {
  const hasRequirements =
    quota.minGpuVram != null ||
    quota.minCpuCores != null ||
    quota.minRamGb != null ||
    quota.minDownloadMbps != null ||
    quota.minUploadMbps != null ||
    (quota.requiredTier === "recommended" &&
      (quota.recGpuVram != null ||
        quota.recCpuCores != null ||
        quota.recRamGb != null ||
        quota.recDownloadMbps != null ||
        quota.recUploadMbps != null));

  if (!hasRequirements) {
    return { tier: "above_rec", compatible: true, reason: null };
  }

  const specs = specsFromPcSpecs(pcSpecs);
  const tier = computeQuotaHostTier(specs, quota);

  if (tier === "below_min") {
    const reason =
      firstFailureReason(specs, {
        gpuVram: quota.minGpuVram,
        cpuCores: quota.minCpuCores,
        ramGb: quota.minRamGb,
        downloadMbps: quota.minDownloadMbps,
        uploadMbps: quota.minUploadMbps,
      }) ?? "ПК не проходит минимальные требования квоты";
    return { tier, compatible: false, reason };
  }

  if (quota.requiredTier === "recommended" && tier !== "above_rec") {
    const reason =
      firstFailureReason(specs, {
        gpuVram: quota.recGpuVram,
        cpuCores: quota.recCpuCores,
        ramGb: quota.recRamGb,
        downloadMbps: quota.recDownloadMbps,
        uploadMbps: quota.recUploadMbps,
      }) ?? "Нужен рекомендуемый уровень железа";
    return { tier, compatible: false, reason };
  }

  return { tier, compatible: true, reason: null };
}

export function validateQuotaFormFields(fields: {
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
  minSessionMinutes: string;
  maxSessionMinutes: string;
  kind: "royalty" | "sponsor";
  royaltyValue: number;
  royaltyBasis: "percent" | "fixed_per_minute";
  budgetLzt: number;
  sponsorHostPerMinute: number;
  sponsorPlayerPerMinute: number;
}): string | null {
  const num = (s: string) => (s.trim() ? Number(s) : null);

  const minSession = num(fields.minSessionMinutes);
  const maxSession = num(fields.maxSessionMinutes);
  if (minSession != null && maxSession != null && minSession > maxSession) {
    return "Минимальная длительность сессии не может быть больше максимальной";
  }

  const pairs: Array<[string, string, string]> = [
    ["minGpuVram", "recGpuVram", "VRAM"],
    ["minCpuCores", "recCpuCores", "ядер CPU"],
    ["minRamGb", "recRamGb", "ГБ RAM"],
    ["minDownloadMbps", "recDownloadMbps", "Мбит/с скачивания"],
    ["minUploadMbps", "recUploadMbps", "Мбит/с отдачи"],
  ];
  for (const [minKey, recKey, label] of pairs) {
    const minVal = num(fields[minKey as keyof typeof fields] as string);
    const recVal = num(fields[recKey as keyof typeof fields] as string);
    if (minVal != null && recVal != null && recVal < minVal) {
      return `Рекомендуемые ${label} должны быть не ниже минимальных`;
    }
  }

  if (fields.kind === "royalty") {
    if (fields.royaltyValue < 0) return "Значение роялти не может быть отрицательным";
    if (fields.royaltyBasis === "percent" && fields.royaltyValue > 100) {
      return "Процент роялти не может быть больше 100";
    }
  }

  if (fields.kind === "sponsor") {
    if (fields.budgetLzt <= 0) return "Бюджет спонсора должен быть больше 0 LZT";
    if (fields.sponsorHostPerMinute < 0 || fields.sponsorPlayerPerMinute < 0) {
      return "Выплаты за минуту не могут быть отрицательными";
    }
    if (fields.sponsorHostPerMinute === 0 && fields.sponsorPlayerPerMinute === 0) {
      return "Спонсорская квота должна платить хосту или игроку за минуту";
    }
  }

  return null;
}
