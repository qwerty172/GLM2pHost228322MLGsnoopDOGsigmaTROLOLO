import { useState } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Copy,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const cardStyle = {
  background: "#0a1018",
  border: "1px solid rgba(255,255,255,0.06)",
};

const inputStyle = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#e2e8f0",
};

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
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const requestWithdrawal = useRequestWithdrawal();

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} скопирован`);
  };

  const handleWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostToken || !withdrawAddress || !withdrawAmount) return;

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Неверная сумма");
      return;
    }

    if (wallet && amount > wallet.creditBalance) {
      toast.error("Недостаточно средств");
      return;
    }

    requestWithdrawal.mutate(
      {
        userToken: hostToken,
        data: {
          currency: withdrawCurrency,
          address: withdrawAddress,
          amount,
        },
      },
      {
        onSuccess: () => {
          toast.success("Запрос на вывод создан");
          setWithdrawAddress("");
          setWithdrawAmount("");
          refetch();
        },
        onError: () => {
          toast.error("Не удалось запросить вывод");
        },
      },
    );
  };

  return (
    <div className="space-y-6 text-slate-300">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">
          Кошелёк
        </h1>
        <p className="text-sm text-slate-500">
          Управляй балансом, депозитами и выводами.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card style={cardStyle}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">
              Доступный баланс
            </CardTitle>
            <Wallet className="h-4 w-4 text-sky-400" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-teal-400">
              {isLoading ? (
                <Skeleton className="h-10 w-32" />
              ) : (
                `$${(wallet?.creditBalance || 0).toFixed(2)}`
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">в эквиваленте USD</p>
          </CardContent>
        </Card>
        <Card style={cardStyle}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">
              Выводы в обработке
            </CardTitle>
            <ArrowUpRight className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-white">
              {isLoading ? (
                <Skeleton className="h-10 w-24" />
              ) : (
                `$${(wallet?.pendingWithdrawals || 0).toFixed(2)}`
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">сейчас обрабатываются</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card style={cardStyle}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <ArrowDownLeft className="h-5 w-5 text-sky-400" />
              Адреса для пополнения
            </CardTitle>
            <CardDescription className="text-slate-500">
              Переводи сюда, чтобы пополнить баланс хоста.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : (
              wallet?.depositAddresses.map((addr) => (
                <div
                  key={addr.currency}
                  className="flex items-center gap-4 p-4 rounded-lg"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div className="p-2 bg-white rounded flex-shrink-0">
                    <QRCodeSVG value={addr.address} size={64} />
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
                        мин: {addr.minDeposit} {addr.currency.split("_")[0]}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-white/10 text-slate-300 hover:text-white"
                        onClick={() =>
                          handleCopy(addr.address, `Адрес ${addr.label}`)
                        }
                      >
                        <Copy className="h-3 w-3 mr-1" /> Копировать
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card style={cardStyle}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <ArrowUpRight className="h-5 w-5 text-sky-400" />
              Запрос на вывод
            </CardTitle>
            <CardDescription className="text-slate-500">
              Выведи заработок хоста в свой крипто-кошелёк.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleWithdraw} className="space-y-6">
              <div className="space-y-3">
                <Label className="text-slate-300">Сеть</Label>
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
                        className="flex flex-col items-center justify-center rounded-md p-3 cursor-pointer transition-all text-center"
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="withdrawAddress" className="text-slate-300">
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

              <div className="space-y-2">
                <Label htmlFor="withdrawAmount" className="text-slate-300">
                  Сумма (USD эквивалент)
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    id="withdrawAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="pl-9 font-mono"
                    style={inputStyle}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 text-xs text-sky-400 hover:text-sky-300"
                    onClick={() =>
                      setWithdrawAmount(wallet?.creditBalance.toString() || "0")
                    }
                  >
                    МАКС
                  </Button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full font-bold"
                style={{ background: "#0ea5e9", color: "#fff" }}
                disabled={
                  requestWithdrawal.isPending ||
                  !withdrawAddress ||
                  !withdrawAmount ||
                  (wallet && parseFloat(withdrawAmount) > wallet.creditBalance)
                }
              >
                {requestWithdrawal.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Подтвердить вывод
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card style={cardStyle}>
        <CardHeader>
          <CardTitle className="text-white">Недавние выводы</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : wallet?.recentWithdrawals.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-sm">
              Выводов пока нет.
            </div>
          ) : (
            <div className="rounded-md border border-white/5 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/5">
                    <TableHead className="text-slate-500">Дата</TableHead>
                    <TableHead className="text-slate-500">Сеть</TableHead>
                    <TableHead className="text-slate-500">Адрес</TableHead>
                    <TableHead className="text-slate-500">Сумма</TableHead>
                    <TableHead className="text-right text-slate-500">
                      Статус
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wallet?.recentWithdrawals.map((w) => (
                    <TableRow key={w.id} className="border-white/5">
                      <TableCell className="text-xs text-slate-500">
                        {formatDistanceToNow(new Date(w.requestedAt))} назад
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-300">
                        {w.currency}
                      </TableCell>
                      <TableCell
                        className="font-mono text-xs truncate max-w-[100px] md:max-w-[200px] text-slate-400"
                        title={w.address}
                      >
                        {w.address.substring(0, 8)}...
                        {w.address.substring(w.address.length - 8)}
                      </TableCell>
                      <TableCell className="font-bold font-mono text-white">
                        ${w.amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="outline"
                          className="text-[10px] uppercase"
                          style={{
                            background:
                              w.status === "completed"
                                ? "rgba(20,184,166,0.15)"
                                : w.status === "failed"
                                  ? "rgba(239,68,68,0.15)"
                                  : "rgba(255,255,255,0.04)",
                            color:
                              w.status === "completed"
                                ? "#2dd4bf"
                                : w.status === "failed"
                                  ? "#f87171"
                                  : "#94a3b8",
                            border:
                              w.status === "completed"
                                ? "1px solid rgba(20,184,166,0.3)"
                                : w.status === "failed"
                                  ? "1px solid rgba(239,68,68,0.3)"
                                  : "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          {w.status === "completed" && (
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                          )}
                          {w.status === "completed"
                            ? "ВЫПОЛНЕН"
                            : w.status === "failed"
                              ? "ОШИБКА"
                              : "В ОБРАБОТКЕ"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
