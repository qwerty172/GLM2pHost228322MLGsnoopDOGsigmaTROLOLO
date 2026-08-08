export const LZT_PER_USDT = 200;

export type PaymentSource = "auto" | "blue" | "green";
export type BlockMinutes = 10 | 15 | 25;

export function parseBlockMinutesParam(search: string): BlockMinutes | undefined {
  const sp = new URLSearchParams(search);
  const v = Number(sp.get("block"));
  return v === 10 || v === 15 || v === 25 ? v : undefined;
}

export function resolveGameBrowserHostUrl(gameBrowserHostUrl: string, baseUrl: string): string {
  return gameBrowserHostUrl.startsWith("http")
    ? gameBrowserHostUrl
    : `${baseUrl}${gameBrowserHostUrl.replace(/^\//, "")}`;
}

export function resolveCoverImageUrl(
  url: string | null | undefined,
  baseUrl: string,
): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${baseUrl}${url.replace(/^\//, "")}`;
}

export function isTestBrowserSession(
  session:
    | {
        isTest?: boolean;
        is_test?: boolean;
        gameBrowserHostUrl?: string | null;
      }
    | null
    | undefined,
): boolean {
  if (!session) return false;
  return !!(session.isTest || session.is_test) && !!session.gameBrowserHostUrl;
}

export function computeRatePerMinLzt(ratePerMinuteUsd: number): number {
  return Math.round(ratePerMinuteUsd * LZT_PER_USDT);
}

export function computeSourceBalance(
  paymentSource: PaymentSource,
  greenLzt: number,
  blueLzt: number,
): number {
  const totalLzt = greenLzt + blueLzt;
  if (paymentSource === "blue") return blueLzt;
  if (paymentSource === "green") return greenLzt;
  return totalLzt;
}

export function computeMinutesAffordable(sourceBalance: number, ratePerMinLzt: number): number {
  return ratePerMinLzt > 0 ? Math.floor(sourceBalance / ratePerMinLzt) : 0;
}

export function needsSessionTopUp(
  sourceBalance: number,
  ratePerMinLzt: number,
  hasClaimed: boolean,
): boolean {
  return ratePerMinLzt > 0 && sourceBalance < ratePerMinLzt && !hasClaimed;
}

export function sanitizeClipGameSlug(
  gameTitle: string | null | undefined,
  appName: string,
): string {
  return (gameTitle || appName || "game")
    .replace(/[^a-z0-9]/gi, "-")
    .toLowerCase()
    .slice(0, 40);
}

export function buildClipFilename(
  gameTitle: string | null | undefined,
  appName: string,
  nowMs = Date.now(),
): string {
  const safeGame = sanitizeClipGameSlug(gameTitle, appName);
  const ts = new Date(nowMs).toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `clip-${safeGame}-${ts}.webm`;
}

/** U-26: пользовательские тексты без WebRTC/ICE/сырых reason-кодов. */
export const INVITE_CORRUPTED_MESSAGE =
  "Приглашение повреждено — откройте ссылку ещё раз или запросите новую.";

export const CONNECTING_OVERLAY_MESSAGE = "Подключаемся к хосту…";

export const RECONNECTING_OVERLAY_SUBMESSAGE = "Восстанавливаем связь…";

const CONTROL_REJECT_MESSAGES: Record<string, string> = {
  host_busy: "Хост сейчас занят с другим игроком. Попробуй позже.",
  game_unavailable: "Игра временно недоступна на этом хосте.",
  host_offline: "Хост сейчас офлайн. Попробуй позже или выбери другого.",
  session_ended: "Сессия уже завершена.",
  balance_exhausted: "Баланс исчерпан — пополни кошелёк, чтобы продолжить.",
  block_expired: "Время блока закончилось.",
  unauthorized: "Не удалось подтвердить доступ. Обнови страницу и попробуй снова.",
  forbidden: "Доступ к этой сессии запрещён.",
};

export function getControlRejectMessage(reason: string): string {
  return CONTROL_REJECT_MESSAGES[reason] ?? "Хост не может принять соединение. Попробуй позже.";
}

export function buildPlayerSignalWsUrl(opts: {
  pageProtocol: string;
  host: string;
  baseUrl: string;
  wsTicket?: string;
  sessionId?: string;
  playerToken: string;
  playerWalletToken?: string;
}): string {
  const wsProtocol = opts.pageProtocol === "https:" ? "wss:" : "ws:";
  const base = `${wsProtocol}//${opts.host}${opts.baseUrl}api/signal?role=player`;
  if (opts.wsTicket && opts.sessionId) {
    return `${base}&wsTicket=${encodeURIComponent(opts.wsTicket)}&sessionId=${encodeURIComponent(opts.sessionId)}`;
  }
  const walletPart = opts.playerWalletToken
    ? `&playerWalletToken=${encodeURIComponent(opts.playerWalletToken)}`
    : "";
  return `${base}&playerToken=${encodeURIComponent(opts.playerToken)}${walletPart}`;
}

export function getConnectionBadgeLabel(connectionState: string, reconnecting: boolean): string {
  if (reconnecting) return "ПЕРЕПОДКЛЮЧЕНИЕ...";
  switch (connectionState) {
    case "connected":
      return "ПОДКЛЮЧЕНО";
    case "connecting":
      return "СОЕДИНЕНИЕ";
    case "disconnected":
      return "ОТКЛЮЧЕНО";
    case "failed":
      return "ОШИБКА СВЯЗИ";
    case "closed":
      return "ЗАКРЫТО";
    case "new":
      return "ИНИЦИАЛИЗАЦИЯ";
    default:
      return "ПОДКЛЮЧЕНИЕ";
  }
}

export function computeWalletBalanceForSession(
  wallet:
    | { withdrawableBalanceLzt?: number; internalBalanceLzt?: number }
    | null
    | undefined,
  paymentSource: string | null | undefined,
  ratePerMinLzt = 0,
): number {
  if (!wallet) return 0;
  const greenLzt = wallet.withdrawableBalanceLzt ?? 0;
  const blueLzt = wallet.internalBalanceLzt ?? 0;
  const src = paymentSource ?? "auto";
  if (src === "blue") return blueLzt;
  if (src === "green") return greenLzt;
  // Billing never combines buckets — estimate billable LZT per bucket, then sum.
  if (ratePerMinLzt > 0) {
    return (
      Math.floor(greenLzt / ratePerMinLzt) * ratePerMinLzt +
      Math.floor(blueLzt / ratePerMinLzt) * ratePerMinLzt
    );
  }
  return Math.max(greenLzt, blueLzt);
}

/** U-25: touch overlays (gamepad + on-screen keyboard) default on when maxTouchPoints > 0. */
export function isTouchCapableDevice(maxTouchPoints: number): boolean {
  return maxTouchPoints > 0;
}
