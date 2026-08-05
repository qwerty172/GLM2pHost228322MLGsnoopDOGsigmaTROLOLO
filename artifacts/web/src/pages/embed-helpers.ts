export function parseEmbedQueryParams(search: string) {
  const params = new URLSearchParams(search);
  const apiKey = params.get("apiKey") || "";
  const gameSlug = params.get("game") || "";
  const resolution = params.get("resolution") || undefined;
  const bitrateKbpsParam = Number(params.get("bitrateKbps"));
  const bitrateKbps =
    Number.isFinite(bitrateKbpsParam) && bitrateKbpsParam > 0 ? bitrateKbpsParam : undefined;
  return { apiKey, gameSlug, resolution, bitrateKbps };
}

export function buildEmbedMissingParamsError() {
  return {
    error: "missing_params",
    message: "Нужны query-параметры apiKey и game",
  };
}

export function getEmbedEndedTitle(reason: string): string {
  return reason === "key_balance_exhausted" ? "Баланс API-ключа исчерпан" : "Сессия завершена";
}

export function getEmbedEndedDetail(reason: string): string {
  return reason === "key_balance_exhausted"
    ? "У ключа разработчика закончился баланс. Пополните кошелёк ключа, чтобы продолжить."
    : `Причина: ${reason}`;
}

export function buildEmbedSignalWsUrl(
  playerToken: string,
  pageProtocol: string,
  host: string,
  baseUrl: string,
): string {
  const wsProtocol = pageProtocol === "https:" ? "wss:" : "ws:";
  return `${wsProtocol}//${host}${baseUrl}api/signal?role=player&playerToken=${encodeURIComponent(playerToken)}`;
}
