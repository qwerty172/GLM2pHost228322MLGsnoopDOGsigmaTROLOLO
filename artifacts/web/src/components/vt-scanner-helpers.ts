export const VT_SCANNER_DEFAULT_LABEL = "Проверить файл игры";

export const VT_SCANNER_STATUS_LABELS = {
  clean: "Чисто",
  suspicious: "Подозрительно",
  malicious: "Угроза обнаружена",
  unknown: "Нет в базе VT",
  error: "Ошибка",
} as const;

export const VT_SCANNER_NETWORK_ERROR_MESSAGE = "Ошибка сети";

export function isVtInputValid(input: string): boolean {
  const trimmed = input.trim();
  return /^[a-fA-F0-9]{64}$/.test(trimmed) || /^https?:\/\/./.test(trimmed);
}

export function isVtUrlInput(input: string): boolean {
  return /^https?:\/\//.test(input.trim());
}

export function canScanVt(input: string, ownerToken: string, scanning: boolean): boolean {
  return isVtInputValid(input) && Boolean(ownerToken) && !scanning;
}

export function createVtNetworkErrorResult() {
  return {
    status: "error" as const,
    harmless: 0,
    suspicious: 0,
    malicious: 0,
    undetected: 0,
    total: 0,
    permalink: "",
    errorMessage: VT_SCANNER_NETWORK_ERROR_MESSAGE,
  };
}
