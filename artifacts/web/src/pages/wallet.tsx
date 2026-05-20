import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  useGetWallet,
  useRequestWithdrawal,
  getGetWalletQueryKey,
} from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Copy,
  ArrowUpRight,
  Loader2,
  Info,
  CreditCard,
  Bitcoin,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ArrowLeftRight,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

const cardStyle = {
  background: "#0a1018",
  border: "1px solid rgba(255,255,255,0.06)",
};

const inputStyle = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#e2e8f0",
};

const LZT_PER_USDT = 200;
const formatLzt = (lzt: number) =>
  new Intl.NumberFormat("ru-RU").format(Math.trunc(lzt));
const lztToUsdt = (lzt: number) => lzt / LZT_PER_USDT;

const TRANSAK_API_KEY = import.meta.env.VITE_TRANSAK_API_KEY as
  | string
  | undefined;
const TRANSAK_HOST = TRANSAK_API_KEY
  ? "https://global.transak.com"
  : "https://global-stg.transak.com";

function buildTransakUrl(opts: {
  walletAddress: string;
  defaultFiatAmount?: number;
  email?: string;
}) {
  const params = new URLSearchParams({
    apiKey: TRANSAK_API_KEY || "4fcd6904-706b-4aff-bd9d-77422813bbb7",
    walletAddress: opts.walletAddress,
    cryptoCurrencyCode: "USDT",
    network: "tron",
    fiatCurrency: "USD",
    defaultFiatAmount: String(opts.defaultFiatAmount ?? 50),
    themeColor: "0ea5e9",
    hideMenu: "true",
    disableWalletAddressForm: "true",
    productsAvailed: "BUY",
  });
  if (opts.email) params.set("email", opts.email);
  return `${TRANSAK_HOST}/?${params.toString()}`;
}

function CardTopUp({
  usdtAddress,
  isLoading,
}: {
  usdtAddress: string | undefined;
  isLoading: boolean;
}) {
  const [opened, setOpened] = useState(false);

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }
  if (!usdtAddress) {
    return (
      <div className="text-center py-6 text-slate-500 text-sm">
        Адрес USDT-TRC20 ещё не готов. Попробуй через минуту.
      </div>
    );
  }

  const widgetUrl = buildTransakUrl({ walletAddress: usdtAddress });
  const isStaging = !TRANSAK_API_KEY;

  if (!opened) {
    return (
      <div
        className="rounded-lg p-5 space-y-4"
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded bg-sky-500/10 border border-sky-500/30">
            <CreditCard className="h-5 w-5 text-sky-400" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="font-bold text-white text-sm">
              Оплата картой через Transak
            </div>
            <div className="text-xs text-slate-400 leading-relaxed">
              Купишь USDT картой Visa / Mastercard / Apple Pay / Google Pay —
              они автоматически прилетят на твой адрес и зачислятся в LZT.
              Комиссия Transak ≈ 1–5%, обработка 5–15 мин.
            </div>
          </div>
        </div>

        <ul className="text-xs text-slate-500 space-y-1.5 pl-1">
          <li>· Адрес кошелька подставлен автоматически</li>
          <li>· Сеть: USDT-TRC20 (Tron) — самые низкие комиссии</li>
          <li>· Минимальная покупка обычно $30</li>
          {isStaging && (
            <li className="text-amber-400">
              · Сейчас включён тестовый режим (staging). Реальные платежи не
              пройдут — добавь VITE_TRANSAK_API_KEY для прод-режима.
            </li>
          )}
        </ul>

        <Button
          type="button"
          onClick={() => setOpened(true)}
          className="w-full font-bold"
          style={{ background: "#0ea5e9", color: "#fff" }}
        >
          <CreditCard className="h-4 w-4 mr-2" />
          Открыть форму оплаты
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          Адрес зачисления:{" "}
          <span className="font-mono text-slate-300">
            {usdtAddress.substring(0, 8)}…
            {usdtAddress.substring(usdtAddress.length - 6)}
          </span>{" "}
          (USDT-TRC20)
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-slate-400 hover:text-white"
          onClick={() => setOpened(false)}
        >
          Свернуть
        </Button>
      </div>
      <div
        className="rounded-lg overflow-hidden"
        style={{ border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <iframe
          src={widgetUrl}
          allow="camera;microphone;payment;clipboard-read;clipboard-write"
          title="Transak: пополнение картой"
          style={{
            width: "100%",
            height: 600,
            border: 0,
            display: "block",
            background: "#0a1018",
          }}
        />
      </div>
      {isStaging && (
        <p className="text-[11px] text-amber-400 text-center">
          Тестовый режим Transak — используй карты-заглушки из их доков.
        </p>
      )}
    </div>
  );
}

function LightningIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M13 2L4.09 12.97H11L10 22L20.5 10.5H13.5L13 2Z" />
    </svg>
  );
}

function LeafIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 5.5-8 5.5z" />
    </svg>
  );
}

export default function WalletPage() {
  const { hostToken } = useAuth();
  const {
    data: wallet,
    isLoading,
    refetch,
  } = useGetWallet(hostToken || "", {
    query: {
      enabled: !!hostToken,
      queryKey: getGetWalletQueryKey(hostToken || ""),
    },
  });

  const [withdrawCurrency, setWithdrawCurrency] = useState("USDT_TRC20");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [withdrawAmountLzt, setWithdrawAmountLzt] = useState("");
  const [topupOpen, setTopupOpen] = useState(false);

  const requestWithdrawal = useRequestWithdrawal();

  const greenLzt = wallet?.withdrawableBalanceLzt ?? 0;
  const blueLzt = wallet?.internalBalanceLzt ?? 0;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} скопирован`);
  };

  const handleWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostToken || !withdrawAddress || !withdrawAmountLzt) return;

    const amountLzt = parseInt(withdrawAmountLzt, 10);
    if (!Number.isFinite(amountLzt) || amountLzt <= 0) {
      toast.error("Введи положительное целое число LZT");
      return;
    }
    if (amountLzt > greenLzt) {
      toast.error("Недостаточно зелёного (выводимого) баланса");
      return;
    }

    requestWithdrawal.mutate(
      {
        userToken: hostToken,
        data: {
          currency: withdrawCurrency,
          address: withdrawAddress,
          amountLzt,
        },
      },
      {
        onSuccess: () => {
          toast.success("Запрос на вывод создан");
          setWithdrawAddress("");
          setWithdrawAmountLzt("");
          refetch();
        },
        onError: () => {
          toast.error("Не удалось запросить вывод");
        },
      },
    );
  };

  const parsedAmount = parseInt(withdrawAmountLzt || "0", 10) || 0;
  const overGreen = parsedAmount > greenLzt;

  return (
    <TooltipProvider>
      <div className="space-y-6 text-slate-300">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Кошелёк
          </h1>
          <p className="text-sm text-slate-500">
            Балансы в LZT. Фиксированный курс: 1 USDT = {LZT_PER_USDT} LZT.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <Card
              style={{
                background: "rgba(14,165,233,0.08)",
                border: "1px solid rgba(14,165,233,0.35)",
              }}
            >
              <CardContent className="pt-6 pb-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-baseline gap-3">
                      <span className="text-5xl font-extrabold text-sky-300 tabular-nums">
                        {isLoading ? (
                          <Skeleton className="h-12 w-40 inline-block" />
                        ) : (
                          formatLzt(blueLzt)
                        )}
                      </span>
                      <LightningIcon className="h-7 w-7 text-sky-400 shrink-0" />
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5">
                      ≈ ${lztToUsdt(blueLzt).toFixed(2)} · нельзя вывести
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-slate-600 cursor-default" />
                        </TooltipTrigger>
                        <TooltipContent>
                          Синие LZT можно тратить на платформе (хосты, будущие
                          Биржа / Форум / Кредиты), но нельзя вывести.
                        </TooltipContent>
                      </Tooltip>
                    </p>
                  </div>
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ background: "rgba(14,165,233,0.15)" }}
                  >
                    <LightningIcon className="h-8 w-8 text-sky-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button
              type="button"
              className="w-full font-semibold h-10"
              style={{ background: "#0ea5e9", color: "#fff" }}
              onClick={() => setTopupOpen((v) => !v)}
              data-testid="button-topup-toggle"
            >
              {topupOpen ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-2" />
                  Свернуть
                </>
              ) : (
                <>
                  <LightningIcon className="h-4 w-4 mr-2" />
                  Пополнить
                </>
              )}
            </Button>

            {topupOpen && (
              <div
                className="rounded-xl overflow-hidden"
                style={{
                  border: "1px solid rgba(14,165,233,0.2)",
                  background: "rgba(14,165,233,0.04)",
                }}
              >
                <div className="p-4">
                  <p className="text-xs text-slate-500 mb-3">
                    Любое пополнение зачисляется на{" "}
                    <span className="text-emerald-400">зелёный</span> баланс по
                    курсу {LZT_PER_USDT} LZT за 1 USDT.
                  </p>
                  <Tabs defaultValue="crypto" className="w-full">
                    <TabsList
                      className="grid w-full grid-cols-2 mb-4"
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <TabsTrigger
                        value="crypto"
                        className="data-[state=active]:bg-sky-500/15 data-[state=active]:text-sky-300 text-slate-400"
                      >
                        <Bitcoin className="h-4 w-4 mr-2" />
                        Криптой
                      </TabsTrigger>
                      <TabsTrigger
                        value="card"
                        className="data-[state=active]:bg-sky-500/15 data-[state=active]:text-sky-300 text-slate-400"
                      >
                        <CreditCard className="h-4 w-4 mr-2" />
                        Картой
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="crypto" className="mt-0">
                      {isLoading ? (
                        <div className="space-y-4">
                          {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-24 w-full" />
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {wallet?.depositAddresses.map((addr) => (
                            <div
                              key={addr.currency}
                              className="flex items-center gap-4 p-4 rounded-lg"
                              style={{
                                background: "rgba(255,255,255,0.02)",
                                border: "1px solid rgba(255,255,255,0.06)",
                              }}
                            >
                              <div className="p-2 bg-white rounded flex-shrink-0">
                                <QRCodeSVG value={addr.address} size={56} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="font-bold text-sm text-white">
                                    {addr.label}
                                  </div>
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] font-mono border-white/10 text-slate-400"
                                  >
                                    {addr.network}
                                  </Badge>
                                </div>
                                <div className="text-xs font-mono text-slate-500 truncate mb-2 select-all">
                                  {addr.address}
                                </div>
                                <div className="flex items-center justify-between">
                                  <div className="text-[10px] text-slate-500">
                                    мин: {addr.minDeposit}{" "}
                                    {addr.currency.split("_")[0]}
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs border-white/10 text-slate-300 hover:text-white"
                                    onClick={() =>
                                      handleCopy(
                                        addr.address,
                                        `Адрес ${addr.label}`,
                                      )
                                    }
                                  >
                                    <Copy className="h-3 w-3 mr-1" /> Копировать
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="card" className="mt-0">
                      <CardTopUp
                        usdtAddress={
                          wallet?.depositAddresses.find(
                            (a) => a.currency === "USDT_TRC20",
                          )?.address
                        }
                        isLoading={isLoading}
                      />
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <Card
              style={{
                background: "rgba(16,185,129,0.08)",
                border: "1px solid rgba(16,185,129,0.35)",
              }}
            >
              <CardContent className="pt-6 pb-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-baseline gap-3">
                      <span className="text-5xl font-extrabold text-emerald-300 tabular-nums">
                        {isLoading ? (
                          <Skeleton className="h-12 w-40 inline-block" />
                        ) : (
                          formatLzt(greenLzt)
                        )}
                      </span>
                      <LeafIcon className="h-7 w-7 text-emerald-400 shrink-0" />
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5">
                      ≈ ${lztToUsdt(greenLzt).toFixed(2)} · можно вывести в
                      крипту
                    </p>
                  </div>
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ background: "rgba(16,185,129,0.15)" }}
                  >
                    <LeafIcon className="h-8 w-8 text-emerald-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Debt & obligations block — always visible once wallet loads */}
            {wallet && (
              <Card
                style={{
                  background: "rgba(99,102,241,0.06)",
                  border: "1px solid rgba(99,102,241,0.25)",
                }}
              >
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <ArrowLeftRight className="h-4 w-4 text-indigo-400" />
                      <span className="text-sm font-semibold text-white">
                        Долг и обязательства
                      </span>
                    </div>
                    <Link href="/exchange">
                      <span className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer transition-colors">
                        Перейти на биржу →
                      </span>
                    </Link>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div
                      className="rounded-lg p-3"
                      style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}
                    >
                      <p className="text-[10px] text-slate-500 mb-1">Я должен</p>
                      <p className="text-lg font-bold text-red-400 tabular-nums">
                        {formatLzt(wallet.creditDebtLzt ?? 0)} LZT
                      </p>
                    </div>
                    <div
                      className="rounded-lg p-3"
                      style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)" }}
                    >
                      <p className="text-[10px] text-slate-500 mb-1">Мне должны</p>
                      <p className="text-lg font-bold text-emerald-400 tabular-nums">
                        {formatLzt(wallet.creditReceivableLzt ?? 0)} LZT
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card style={cardStyle}>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-white text-base">
                  <ArrowUpRight className="h-4 w-4 text-sky-400" />
                  Вывод средств
                </CardTitle>
                <CardDescription className="text-slate-500 text-xs">
                  Конвертируем{" "}
                  <span className="text-emerald-400">зелёный</span> LZT в крипту
                  по курсу {LZT_PER_USDT}:1.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleWithdraw} className="space-y-4">
                  <RadioGroup
                    value={withdrawCurrency}
                    onValueChange={setWithdrawCurrency}
                    className="grid grid-cols-3 gap-2"
                  >
                    {[
                      { id: "USDT_TRC20", label: "USDT", net: "TRC20" },
                      { id: "SOL", label: "SOL", net: "Solana" },
                      { id: "NANO", label: "XNO", net: "Nano" },
                    ].map((c) => (
                      <div key={c.id}>
                        <RadioGroupItem
                          value={c.id}
                          id={`withdraw-${c.id}`}
                          className="peer sr-only"
                        />
                        <Label
                          htmlFor={`withdraw-${c.id}`}
                          className="flex flex-col items-center justify-center rounded-md p-2.5 cursor-pointer transition-all text-center"
                          style={{
                            background:
                              withdrawCurrency === c.id
                                ? "rgba(14,165,233,0.1)"
                                : "rgba(255,255,255,0.02)",
                            border:
                              withdrawCurrency === c.id
                                ? "2px solid #0ea5e9"
                                : "2px solid rgba(255,255,255,0.06)",
                          }}
                        >
                          <span className="font-bold text-sm text-white">
                            {c.label}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {c.net}
                          </span>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="withdrawAddress"
                      className="text-xs text-slate-400"
                    >
                      Адрес получателя
                    </Label>
                    <Input
                      id="withdrawAddress"
                      placeholder="Вставь адрес своего кошелька"
                      value={withdrawAddress}
                      onChange={(e) => setWithdrawAddress(e.target.value)}
                      className="font-mono text-sm"
                      style={inputStyle}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="withdrawAmount"
                      className="text-xs text-slate-400"
                    >
                      Сумма (LZT)
                    </Label>
                    <div className="relative">
                      <Input
                        id="withdrawAmount"
                        type="number"
                        step="1"
                        min="0"
                        placeholder="0"
                        value={withdrawAmountLzt}
                        onChange={(e) => setWithdrawAmountLzt(e.target.value)}
                        className="font-mono pr-16"
                        style={inputStyle}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 text-xs text-sky-400 hover:text-sky-300"
                        onClick={() => setWithdrawAmountLzt(String(greenLzt))}
                        disabled={greenLzt < 1}
                      >
                        МАКС
                      </Button>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      ≈ ${lztToUsdt(parsedAmount).toFixed(4)}
                    </p>
                  </div>

                  {greenLzt === 0 ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <Button
                            type="submit"
                            className="w-full font-bold"
                            style={{ background: "#0ea5e9", color: "#fff" }}
                            disabled
                          >
                            Подтвердить вывод
                          </Button>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        У тебя нет{" "}
                        <span className="text-emerald-400">зелёного</span> LZT.
                        Синий баланс вывести нельзя.
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <Button
                      type="submit"
                      className="w-full font-bold"
                      style={{ background: "#0ea5e9", color: "#fff" }}
                      disabled={
                        requestWithdrawal.isPending ||
                        !withdrawAddress ||
                        !withdrawAmountLzt ||
                        overGreen ||
                        parsedAmount <= 0
                      }
                    >
                      {requestWithdrawal.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {overGreen ? (
                        "Недостаточно баланса"
                      ) : (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Подтвердить вывод
                        </>
                      )}
                    </Button>
                  )}
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
