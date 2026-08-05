import { Link } from "wouter";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Clock, Loader2, Wifi, X } from "lucide-react";
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

const DEFAULT_CREDIT_LZT = 3000;

type WalletLike = {
  internalBalanceLzt?: number;
  withdrawableBalanceLzt?: number;
  creditDebtLzt?: number;
  creditLimitLzt?: number;
};

export function PreSessionScreen({
  hostDisplayName,
  gameTitle,
  coverImageUrl,
  pricePerMinuteLzt,
  resolution,
  bitrateKbps,
  wallet,
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
  wallet?: WalletLike;
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
  const initialBlock =
    initialBlockMinutes != null ? String(initialBlockMinutes) : "unlimited";
  const [blockChoice, setBlockChoice] = useState<"unlimited" | "10" | "15" | "25">(
    initialBlock === "10" || initialBlock === "15" || initialBlock === "25"
      ? (initialBlock as "10" | "15" | "25")
      : "unlimited",
  );

  useEffect(() => {
    if (didPing.current) return;
    didPing.current = true;
    const t0 = performance.now();
    publicPing()
      .then(() => setPingMs(Math.round(performance.now() - t0)))
      .catch(() => setPingMs(null))
      .finally(() => setPinging(false));
  }, []);

  const balanceLzt = (wallet?.internalBalanceLzt ?? 0) + (wallet?.withdrawableBalanceLzt ?? 0);
  const totalAvailableLzt = balanceLzt;
  const creditLimit = wallet?.creditLimitLzt ?? DEFAULT_CREDIT_LZT;
  const creditUsed = wallet?.creditDebtLzt ?? 0;
  const creditAvailable = Math.max(0, creditLimit - creditUsed);
  const minsAvailable = computeMinsAvailable(totalAvailableLzt, pricePerMinuteLzt);

  const blockOptions: Array<{ mins: 10 | 15 | 25; label: string }> = [
    { mins: 10, label: "10 мин" },
    { mins: 15, label: "15 мин" },
    { mins: 25, label: "25 мин" },
  ];
  const selectedBlockMins =
    blockChoice === "unlimited" ? null : (Number(blockChoice) as 10 | 15 | 25);
  const blockCost = selectedBlockMins ? selectedBlockMins * pricePerMinuteLzt : null;
  const blockAffordable = canAffordBlock(totalAvailableLzt, blockCost);
  const canStart = !sessionEnded && minsAvailable >= 1 && blockAffordable && !isTest;
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
                {isTest ? "0" : pricePerMinuteLzt} LZT
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {isTest
                  ? "бесплатно"
                  : `в минуту · ${pricePerMinuteLzt * 60} LZT/час`}
              </p>
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
                {blockOptions.map((opt) => {
                  const cost = opt.mins * pricePerMinuteLzt;
                  const affordable = totalAvailableLzt >= cost;
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
                  style={{
                    color:
                      minsAvailable >= 30
                        ? "#2dd4bf"
                        : minsAvailable >= 5
                          ? "#eab308"
                          : "#ef4444",
                  }}
                >
                  {minsAvailable >= 9999 ? "∞" : formatDuration(minsAvailable)}
                </p>
              </div>
              {minsAvailable < 5 && (
                <Link href="/wallet">
                  <Button size="sm" variant="outline" className="text-xs border-white/10 text-slate-300">
                    Пополнить
                  </Button>
                </Link>
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
            <Link href="/wallet" className="block">
              <Button
                className="w-full h-11 font-bold text-sm rounded-xl"
                style={{ background: "#0ea5e9", color: "#fff" }}
              >
                {!blockAffordable ? "Недостаточно для блока" : "Пополнить кошелёк"}
              </Button>
            </Link>
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
              ) : blockCost !== null ? (
                `Зарезервировать ${blockCost.toLocaleString("ru-RU")} LZT и начать`
              ) : (
                "Начать игру"
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
