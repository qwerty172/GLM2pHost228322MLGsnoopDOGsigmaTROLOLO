import { Link } from "wouter";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Clock, Copy, Loader2, Wifi, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { publicPing } from "@workspace/api-client-react";
import {
  canAffordBlock,
  computeMinsAvailable,
  formatDuration,
  getPingColor,
  getPingLabel,
  resolveCoverImageUrl,
} from "@/pages/game-detail-helpers";
import type { PaymentSource } from "@/pages/play-helpers";
import {
  findUsdtTrc20Address,
  formatUsdtAddressPreview,
  LZT_PER_USDT,
} from "@/pages/wallet-helpers";

export const PRE_SESSION_DEFAULT_CREDIT_LZT = 3000;
export const PRE_SESSION_TARGET_MINS = 30;

export type PreSessionWalletLike = {
  internalBalanceLzt?: number;
  withdrawableBalanceLzt?: number;
  creditDebtLzt?: number;
  creditLimitLzt?: number;
};

export type PreSessionDepositAddress = {
  currency: string;
  label: string;
  address: string;
  network: string;
  minDeposit: number;
};

export type PreSessionBlockChoice = "unlimited" | "10" | "15" | "25";

export const PRE_SESSION_BLOCK_OPTIONS: Array<{ mins: 10 | 15 | 25; label: string }> = [
  { mins: 10, label: "10 мин" },
  { mins: 15, label: "15 мин" },
  { mins: 25, label: "25 мин" },
];

export function resolveInitialBlockChoice(
  initialBlockMinutes?: 10 | 15 | 25,
): PreSessionBlockChoice {
  const initialBlock =
    initialBlockMinutes != null ? String(initialBlockMinutes) : "unlimited";
  return initialBlock === "10" || initialBlock === "15" || initialBlock === "25"
    ? (initialBlock as "10" | "15" | "25")
    : "unlimited";
}

export function computePreSessionWalletTotals(wallet?: PreSessionWalletLike) {
  const balanceLzt =
    (wallet?.internalBalanceLzt ?? 0) + (wallet?.withdrawableBalanceLzt ?? 0);
  const totalAvailableLzt = balanceLzt;
  const creditLimit = wallet?.creditLimitLzt ?? PRE_SESSION_DEFAULT_CREDIT_LZT;
  const creditUsed = wallet?.creditDebtLzt ?? 0;
  const creditAvailable = Math.max(0, creditLimit - creditUsed);
  return { balanceLzt, totalAvailableLzt, creditLimit, creditUsed, creditAvailable };
}

export function computeSelectedBlockMins(
  blockChoice: PreSessionBlockChoice,
): 10 | 15 | 25 | null {
  return blockChoice === "unlimited" ? null : (Number(blockChoice) as 10 | 15 | 25);
}

export function computePreSessionCanStart(
  sessionEnded: boolean | undefined,
  minsAvailable: number,
  blockAffordable: boolean,
  isTest: boolean | undefined,
): boolean {
  return !sessionEnded && minsAvailable >= 1 && blockAffordable && !isTest;
}

export function getPreSessionMinsAvailableColor(minsAvailable: number): string {
  if (minsAvailable >= 30) return "#2dd4bf";
  if (minsAvailable >= 5) return "#eab308";
  return "#ef4444";
}

export function formatPreSessionMinsDisplay(
  minsAvailable: number,
  formatDurationFn: (mins: number) => string = formatDuration,
): string {
  return minsAvailable >= 9999 ? "∞" : formatDurationFn(minsAvailable);
}

export function formatPreSessionPriceLabel(
  isTest: boolean | undefined,
  pricePerMinuteLzt: number,
): { price: string; subtitle: string } {
  if (isTest) {
    return { price: "0", subtitle: "бесплатно" };
  }
  return {
    price: String(pricePerMinuteLzt),
    subtitle: `в минуту · ${pricePerMinuteLzt * 60} LZT/час`,
  };
}

export function getPreSessionStartButtonLabel(
  blockCost: number | null,
): string {
  if (blockCost !== null) {
    return `Зарезервировать ${blockCost.toLocaleString("ru-RU")} LZT и начать`;
  }
  return "Начать игру";
}

export function isPreSessionBlockOptionAffordable(
  totalAvailableLzt: number,
  blockMins: 10 | 15 | 25,
  pricePerMinuteLzt: number,
): boolean {
  return totalAvailableLzt >= blockMins * pricePerMinuteLzt;
}

export function computePreSessionTargetCostLzt(
  pricePerMinuteLzt: number,
  targetMins = PRE_SESSION_TARGET_MINS,
): number {
  return pricePerMinuteLzt * targetMins;
}

export function computePreSessionShortfallLzt(
  totalAvailableLzt: number,
  pricePerMinuteLzt: number,
  targetMins = PRE_SESSION_TARGET_MINS,
): number {
  const needed = computePreSessionTargetCostLzt(pricePerMinuteLzt, targetMins);
  return Math.max(0, needed - totalAvailableLzt);
}

export function needsPreSessionInlineTopUp(
  minsAvailable: number,
  blockAffordable: boolean,
  targetMins = PRE_SESSION_TARGET_MINS,
): boolean {
  return minsAvailable < targetMins || !blockAffordable;
}

export function formatPreSessionShortfallHint(
  totalAvailableLzt: number,
  pricePerMinuteLzt: number,
  targetMins = PRE_SESSION_TARGET_MINS,
): string {
  const needed = computePreSessionTargetCostLzt(pricePerMinuteLzt, targetMins);
  const shortfall = computePreSessionShortfallLzt(
    totalAvailableLzt,
    pricePerMinuteLzt,
    targetMins,
  );
  if (shortfall <= 0) {
    return `На ${targetMins} минут нужно ${needed.toLocaleString("ru-RU")} LZT — баланс достаточен.`;
  }
  return `На ${targetMins} минут нужно ${needed.toLocaleString("ru-RU")} LZT — не хватает ${shortfall.toLocaleString("ru-RU")} LZT.`;
}

export function PreSessionScreen({
  hostDisplayName,
  gameTitle,
  coverImageUrl,
  pricePerMinuteLzt,
  resolution,
  bitrateKbps,
  wallet,
  depositAddresses,
  initialBlockMinutes,
  isTest,
  claimError,
  isClaiming,
  sessionEnded,
  paymentSource,
  onPaymentSourceChange,
  showPaymentOptions,
  onTogglePaymentOptions,
  onConfirm,
  onBackHref,
}: {
  hostDisplayName: string;
  gameTitle: string;
  coverImageUrl?: string | null;
  pricePerMinuteLzt: number;
  resolution?: string;
  bitrateKbps?: number;
  wallet?: PreSessionWalletLike;
  depositAddresses?: PreSessionDepositAddress[];
  initialBlockMinutes?: 10 | 15 | 25;
  isTest?: boolean;
  claimError?: string | null;
  isClaiming?: boolean;
  sessionEnded?: boolean;
  paymentSource: PaymentSource;
  onPaymentSourceChange: (src: PaymentSource) => void;
  showPaymentOptions: boolean;
  onTogglePaymentOptions: () => void;
  onConfirm: (blockMinutes?: 10 | 15 | 25) => void;
  onBackHref?: string;
}) {
  const [pingMs, setPingMs] = useState<number | null>(null);
  const [pinging, setPinging] = useState(true);
  const didPing = useRef(false);
  const [blockChoice, setBlockChoice] = useState<PreSessionBlockChoice>(
    resolveInitialBlockChoice(initialBlockMinutes),
  );
  const [topUpOpen, setTopUpOpen] = useState(false);

  const copyDepositAddress = (address: string, label: string) => {
    void navigator.clipboard.writeText(address).then(
      () => toast.success(`${label} скопирован`),
      () => toast.error("Не удалось скопировать в буфер обмена"),
    );
  };

  useEffect(() => {
    if (didPing.current) return;
    didPing.current = true;
    const t0 = performance.now();
    publicPing()
      .then(() => setPingMs(Math.round(performance.now() - t0)))
      .catch(() => setPingMs(null))
      .finally(() => setPinging(false));
  }, []);

  const { totalAvailableLzt, creditAvailable } = computePreSessionWalletTotals(wallet);
  const minsAvailable = computeMinsAvailable(totalAvailableLzt, pricePerMinuteLzt);

  const selectedBlockMins = computeSelectedBlockMins(blockChoice);
  const blockCost = selectedBlockMins ? selectedBlockMins * pricePerMinuteLzt : null;
  const blockAffordable = canAffordBlock(totalAvailableLzt, blockCost);
  const canStart = computePreSessionCanStart(
    sessionEnded,
    minsAvailable,
    blockAffordable,
    isTest,
  );
  const needsInlineTopUp = !isTest && needsPreSessionInlineTopUp(minsAvailable, blockAffordable);
  const shortfallHint = !isTest
    ? formatPreSessionShortfallHint(totalAvailableLzt, pricePerMinuteLzt)
    : "";
  const usdtDepositAddress = findUsdtTrc20Address(depositAddresses);
  const priceLabel = formatPreSessionPriceLabel(isTest, pricePerMinuteLzt);
  const cover = coverImageUrl
    ? resolveCoverImageUrl(coverImageUrl, import.meta.env.BASE_URL)
    : null;

  const pingColor = getPingColor(pingMs);
  const pingLabel = getPingLabel(pingMs);

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "#06090e" }}
    >
      <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,rgba(14,165,233,0.1),transparent_50%)]" />
      <div
        className="w-full max-w-md relative z-10 rounded-2xl overflow-hidden"
        style={{ background: "#0a1018", border: "1px solid rgba(14,165,233,0.2)" }}
        data-testid="pre-session-screen"
      >
        <div className="px-5 pt-5 pb-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {cover ? (
              <div
                className="w-12 h-16 rounded-lg overflow-hidden shrink-0"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <img src={cover} alt={gameTitle} className="w-full h-full object-cover" />
              </div>
            ) : null}
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500 uppercase tracking-widest mb-0.5">Подготовка</p>
              <p className="font-bold text-white text-base truncate">{gameTitle}</p>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="w-2 h-2 rounded-full bg-teal-400 shrink-0"
                  style={{ boxShadow: "0 0 6px rgba(45,212,191,0.6)" }}
                />
                <span className="text-sm text-slate-400 truncate">{hostDisplayName}</span>
              </div>
            </div>
          </div>
          {onBackHref && (
            <Link href={onBackHref}>
              <button
                type="button"
                className="text-slate-500 hover:text-white transition-colors p-1 rounded shrink-0"
                title="Назад"
              >
                <X className="h-4 w-4" />
              </button>
            </Link>
          )}
        </div>

        <div className="px-5 py-4 space-y-3">
          {(resolution || bitrateKbps) && (
            <p className="text-xs text-slate-500 font-mono text-center">
              {resolution && <span>{resolution}</span>}
              {resolution && bitrateKbps && <span> · </span>}
              {bitrateKbps && <span>{bitrateKbps} кбит/с</span>}
              {isTest && <span className="text-violet-300"> · тест · бесплатно</span>}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div
              className="rounded-xl p-3"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Wifi className="h-3 w-3" /> Пинг
              </p>
              {pinging ? (
                <Loader2 className="h-4 w-4 text-slate-500 animate-spin" />
              ) : (
                <>
                  <p className="text-lg font-bold font-mono" style={{ color: pingColor }}>
                    {pingMs !== null ? `${pingMs} мс` : "—"}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: pingColor, opacity: 0.75 }}>
                    {pingLabel}
                  </p>
                </>
              )}
            </div>

            <div
              className="rounded-xl p-3"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Clock className="h-3 w-3" /> Стоимость
              </p>
              <p className="text-lg font-bold font-mono text-white">
                {priceLabel.price} LZT
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">{priceLabel.subtitle}</p>
            </div>
          </div>

          {!isTest && (
            <div
              className="rounded-xl p-3"
              style={{ background: "rgba(14,165,233,0.05)", border: "1px solid rgba(14,165,233,0.12)" }}
            >
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">
                Доступно для игры
              </p>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />
                    Игровой баланс
                  </span>
                  <span className="font-mono text-white">
                    {(wallet?.internalBalanceLzt ?? 0).toLocaleString("ru-RU")} LZT
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                    К выводу
                  </span>
                  <span className="font-mono text-white">
                    {(wallet?.withdrawableBalanceLzt ?? 0).toLocaleString("ru-RU")} LZT
                  </span>
                </div>
                {creditAvailable > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Кредит (не для claim)</span>
                    <span className="font-mono text-slate-500">
                      +{creditAvailable.toLocaleString("ru-RU")} LZT
                    </span>
                  </div>
                )}
                <div
                  className="flex justify-between items-center pt-1.5 border-t"
                  style={{ borderColor: "rgba(14,165,233,0.15)" }}
                >
                  <span className="text-slate-300 font-medium">Для старта сессии</span>
                  <span className="font-mono font-bold text-sky-300">
                    {totalAvailableLzt.toLocaleString("ru-RU")} LZT
                  </span>
                </div>
              </div>
            </div>
          )}

          {!isTest && needsInlineTopUp && pricePerMinuteLzt > 0 && (
            <div
              className="rounded-xl p-3 space-y-3"
              style={{
                background: "rgba(239,68,68,0.07)",
                border: "1px solid rgba(239,68,68,0.25)",
              }}
              data-testid="pre-session-shortfall"
            >
              <div>
                <p className="text-[10px] text-red-300/80 uppercase tracking-wider mb-1">
                  Не хватает LZT
                </p>
                <p className="text-sm text-slate-200 leading-snug">{shortfallHint}</p>
                <p className="text-[10px] text-slate-500 mt-1">
                  У вас {totalAvailableLzt.toLocaleString("ru-RU")} LZT для старта сессии
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                className="w-full text-xs font-semibold"
                style={{ background: "#0ea5e9", color: "#fff" }}
                data-testid="button-pre-session-topup"
                onClick={() => setTopUpOpen((v) => !v)}
              >
                {topUpOpen ? "Свернуть пополнение" : "Пополнить здесь"}
              </Button>
              {topUpOpen && (
                <div
                  className="rounded-lg p-3 space-y-3"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                  data-testid="pre-session-inline-topup"
                >
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Отправь USDT, SOL или Nano — зачисление на «К выводу» по курсу{" "}
                    {LZT_PER_USDT} LZT за 1 USDT. После пополнения баланс обновится
                    автоматически.
                  </p>
                  {depositAddresses?.length ? (
                    <div className="space-y-2">
                      {depositAddresses.map((addr) => (
                        <div
                          key={addr.currency}
                          className="flex items-center gap-3 p-2 rounded-lg"
                          style={{
                            background: "rgba(255,255,255,0.02)",
                            border: "1px solid rgba(255,255,255,0.06)",
                          }}
                        >
                          <div className="p-1 bg-white rounded shrink-0">
                            <QRCodeSVG value={addr.address} size={48} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white">{addr.label}</p>
                            <p className="text-[10px] text-slate-500 font-mono truncate">
                              {formatUsdtAddressPreview(addr.address)}
                            </p>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-[9px] text-slate-500">
                                мин. {addr.minDeposit} {addr.currency.split("_")[0]}
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-6 text-[10px] border-white/10 text-slate-300"
                                onClick={() => copyDepositAddress(addr.address, addr.label)}
                              >
                                <Copy className="h-3 w-3 mr-1" />
                                Копировать
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : usdtDepositAddress ? (
                    <div
                      className="flex items-center gap-3 p-2 rounded-lg"
                      style={{
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <div className="p-1 bg-white rounded shrink-0">
                        <QRCodeSVG value={usdtDepositAddress} size={48} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white">USDT</p>
                        <p className="text-[10px] text-slate-500 font-mono truncate">
                          {formatUsdtAddressPreview(usdtDepositAddress)}
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] border-white/10 text-slate-300 mt-1"
                          onClick={() => copyDepositAddress(usdtDepositAddress, "Адрес USDT")}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Копировать
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 text-center py-2">
                      Адрес пополнения загружается…
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {!isTest && pricePerMinuteLzt > 0 && (
            <div
              className="rounded-xl p-3"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Clock className="h-3 w-3" /> Блок времени
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  className="rounded-lg py-2 text-xs font-medium transition-all"
                  style={
                    blockChoice === "unlimited"
                      ? { background: "#0ea5e9", color: "#fff", border: "1px solid #0ea5e9" }
                      : {
                          background: "transparent",
                          color: "#94a3b8",
                          border: "1px solid rgba(255,255,255,0.08)",
                        }
                  }
                  onClick={() => setBlockChoice("unlimited")}
                >
                  ∞
                </button>
                {PRE_SESSION_BLOCK_OPTIONS.map((opt) => {
                  const cost = opt.mins * pricePerMinuteLzt;
                  const affordable = isPreSessionBlockOptionAffordable(
                    totalAvailableLzt,
                    opt.mins,
                    pricePerMinuteLzt,
                  );
                  return (
                    <button
                      key={opt.mins}
                      type="button"
                      className="rounded-lg py-1.5 text-xs font-medium transition-all"
                      style={
                        blockChoice === String(opt.mins)
                          ? { background: "#0ea5e9", color: "#fff", border: "1px solid #0ea5e9" }
                          : !affordable
                            ? {
                                background: "transparent",
                                color: "#475569",
                                border: "1px solid rgba(255,255,255,0.04)",
                                cursor: "not-allowed",
                              }
                            : {
                                background: "transparent",
                                color: "#94a3b8",
                                border: "1px solid rgba(255,255,255,0.08)",
                              }
                      }
                      onClick={() =>
                        affordable && setBlockChoice(String(opt.mins) as "10" | "15" | "25")
                      }
                      disabled={!affordable}
                    >
                      <div>{opt.label}</div>
                      <div className="text-[9px] opacity-70">{cost.toLocaleString("ru-RU")} LZT</div>
                    </button>
                  );
                })}
              </div>
              {blockCost !== null && (
                <p className="text-[10px] text-slate-500 mt-2">
                  Стоимость блока:{" "}
                  <span className="text-sky-400 font-mono">
                    {blockCost.toLocaleString("ru-RU")} LZT
                  </span>{" "}
                  — резервируется заранее, остаток возвращается.
                </p>
              )}
            </div>
          )}

          {!isTest && (
            <div
              className="rounded-xl px-4 py-3 flex items-center justify-between"
              style={{
                background:
                  minsAvailable >= 30
                    ? "rgba(45,212,191,0.07)"
                    : minsAvailable >= 5
                      ? "rgba(234,179,8,0.07)"
                      : "rgba(239,68,68,0.07)",
                border: `1px solid ${
                  minsAvailable >= 30
                    ? "rgba(45,212,191,0.2)"
                    : minsAvailable >= 5
                      ? "rgba(234,179,8,0.2)"
                      : "rgba(239,68,68,0.2)"
                }`,
              }}
            >
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Сможешь играть</p>
                <p
                  className="text-2xl font-extrabold font-mono mt-0.5"
                  style={{ color: getPreSessionMinsAvailableColor(minsAvailable) }}
                >
                  {formatPreSessionMinsDisplay(minsAvailable)}
                </p>
              </div>
              {needsInlineTopUp && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-xs border-white/10 text-slate-300"
                  onClick={() => setTopUpOpen(true)}
                >
                  Пополнить
                </Button>
              )}
            </div>
          )}

          {(claimError || showPaymentOptions) && !isTest && (
            <div className="space-y-2">
              <button
                type="button"
                className="text-xs text-sky-400 hover:text-sky-300"
                onClick={onTogglePaymentOptions}
              >
                {showPaymentOptions ? "Скрыть способ оплаты" : "Выбрать способ оплаты"}
              </button>
              {showPaymentOptions && (
                <RadioGroup
                  value={paymentSource}
                  onValueChange={(v) => onPaymentSourceChange(v as PaymentSource)}
                  className="grid grid-cols-3 gap-2"
                >
                  {(["auto", "green", "blue"] as PaymentSource[]).map((src) => (
                    <div key={src}>
                      <RadioGroupItem value={src} id={`prep-src-${src}`} className="peer sr-only" />
                      <Label
                        htmlFor={`prep-src-${src}`}
                        className="flex flex-col items-center justify-center rounded-md p-2 cursor-pointer text-xs text-slate-300"
                        style={{
                          background:
                            paymentSource === src
                              ? "rgba(14,165,233,0.12)"
                              : "rgba(255,255,255,0.02)",
                          border:
                            paymentSource === src
                              ? "2px solid #0ea5e9"
                              : "2px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        <span className="font-bold">
                          {src === "auto" ? "Авто" : src === "green" ? "К выводу" : "Игровой"}
                        </span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
            </div>
          )}

          {claimError && (
            <div
              className="p-3 rounded-md text-sm"
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "#fca5a5",
              }}
            >
              {claimError}
            </div>
          )}
        </div>

        <div className="px-5 pb-5">
          {isTest ? (
            <Button
              className="w-full h-11 font-bold text-sm rounded-xl"
              style={{ background: "#0ea5e9", color: "#fff" }}
              onClick={() => onConfirm()}
              disabled={sessionEnded || isClaiming}
            >
              {isClaiming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Запуск…
                </>
              ) : sessionEnded ? (
                "Сессия завершена"
              ) : (
                <>
                  Начать тест
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          ) : minsAvailable < 1 || !blockAffordable ? (
            <Button
              type="button"
              className="w-full h-11 font-bold text-sm rounded-xl"
              style={{ background: "#0ea5e9", color: "#fff" }}
              data-testid="button-pre-session-topup-cta"
              onClick={() => setTopUpOpen(true)}
            >
              {!blockAffordable ? "Недостаточно для блока — пополнить здесь" : "Пополнить здесь"}
            </Button>
          ) : (
            <Button
              className="w-full h-11 font-bold text-sm rounded-xl"
              style={{
                background: canStart && !isClaiming ? "#0ea5e9" : "#1e293b",
                color: canStart && !isClaiming ? "#fff" : "#64748b",
              }}
              onClick={() => onConfirm(selectedBlockMins ?? undefined)}
              disabled={!canStart || isClaiming}
            >
              {isClaiming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Занимаем сессию…
                </>
              ) : sessionEnded ? (
                "Сессия завершена"
              ) : (
                getPreSessionStartButtonLabel(blockCost)
              )}
              {canStart && !isClaiming && !sessionEnded && (
                <ArrowRight className="ml-2 h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
