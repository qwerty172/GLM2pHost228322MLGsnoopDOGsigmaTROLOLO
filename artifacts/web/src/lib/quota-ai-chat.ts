import { formatApiError } from "@/lib/api-errors";

export type QuotaFormState = {
  kind: string;
  title: string;
  description: string;
  visibility: string;
  royaltyBasis: string;
  royaltyValue: number;
  royaltySource: string;
  budgetLzt: number;
  sponsorHostPerMinute: number;
  sponsorPlayerPerMinute: number;
  gameId: string;
  minSessionMinutes: string;
  maxSessionMinutes: string;
  startAt: string;
  endAt: string;
  minGpuVram?: string;
  minCpuCores?: string;
  minRamGb?: string;
  minDownloadMbps?: string;
  minUploadMbps?: string;
  recGpuVram?: string;
  recCpuCores?: string;
  recRamGb?: string;
  recDownloadMbps?: string;
  recUploadMbps?: string;
  requiredTier?: "min" | "recommended";
};

export type QuotaFormPatch = {
  kind?: string;
  title?: string;
  description?: string;
  visibility?: string;
  royaltyBasis?: string;
  royaltyValue?: number;
  royaltySource?: string;
  budgetLzt?: number;
  sponsorHostPerMinute?: number;
  sponsorPlayerPerMinute?: number;
  gameId?: string;
  minSessionMinutes?: string;
  maxSessionMinutes?: string;
  startAt?: string;
  endAt?: string;
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
  requiredTier?: "min" | "recommended";
};

export const QUOTA_AI_CHAT_STARTERS = [
  "Спонсирую плейтест Cyberpunk — бюджет 50000 LZT, хосту 100 LZT/мин",
  "Беру 10% royalty из доли хоста для своих модов",
  "Бесплатные 30 минут новичкам — спонсорская квота, игроку 5 LZT/мин",
];

export function canSendQuotaChatMessage(text: string, loading: boolean): boolean {
  return text.trim().length > 0 && !loading;
}

export function shouldSubmitQuotaChatOnEnter(key: string, shiftKey: boolean): boolean {
  return key === "Enter" && !shiftKey;
}

export function hasQuotaFormPatch(patch: QuotaFormPatch | null | undefined): boolean {
  return Boolean(patch && Object.keys(patch).length > 0);
}

export function formatQuotaAiChatError(err: unknown): string {
  return formatApiError(err, "Не удалось связаться с ИИ. Попробуй ещё раз.");
}
