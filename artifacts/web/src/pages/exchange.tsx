import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { usePlayerWallet } from "@/hooks/use-player-wallet";
import {
  useListLoanRequests,
  useCreateLoanRequest,
  useFundLoanRequest,
  useListMyLoans,
  useRepayLoan,
  getListLoanRequestsQueryKey,
  getListMyLoansQueryKey,
  type LoanRequest,
  type Loan,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetWalletQueryKey } from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ArrowLeftRight,
  TrendingUp,
  Clock,
  Loader2,
  HandCoins,
  Plus,
  AlertCircle,
  CheckCircle2,
  Wallet,
} from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { toast } from "sonner";

const formatLzt = (n: number) => new Intl.NumberFormat("ru-RU").format(Math.trunc(n));
const MIN_TERM_DAYS = 60;

function bpsToPercent(bps: number) {
  return (bps / 100).toFixed(2);
}

function serverErrorToRu(msg: string): string {
  if (/pledger limit/i.test(msg)) return "Pledger-лимит равен нулю — сначала сделай хотя бы один депозит или вывод";
  if (/amountLzt exceeds/i.test(msg)) return "Сумма превышает твой Pledger-лимит";
  if (/termDays must be/i.test(msg)) return `Срок должен быть не менее ${MIN_TERM_DAYS} дней`;
  if (/not open/i.test(msg)) return "Заявка уже не в открытом статусе";
  if (/own request/i.test(msg)) return "Нельзя финансировать собственную заявку";
  if (/insufficient lender/i.test(msg)) return "Недостаточно баланса для финансирования";
  if (/insufficient/i.test(msg)) return "Недостаточно баланса";
  if (/not your loan/i.test(msg)) return "Это не твой займ";
  if (/not repayable/i.test(msg)) return "Займ нельзя погасить (возможно, уже закрыт)";
  return msg;
}

function LoanRequestCard({
  req,
  myToken,
  onFund,
}: {
  req: LoanRequest;
  myToken: string | null;
  onFund: (req: LoanRequest) => void;
}) {
  const ratePercent = bpsToPercent(req.rateBps);
  const fundedPct = req.amountLzt > 0 ? Math.round((req.fundedAmountLzt / req.amountLzt) * 100) : 0;
  const remaining = req.amountLzt - req.fundedAmountLzt;

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-2xl font-extrabold text-white tabular-nums">
            {formatLzt(req.amountLzt)}
          </span>
          <span className="text-sm text-slate-400 ml-2">LZT</span>
        </div>
        <Badge
          variant="outline"
          className="shrink-0 text-emerald-400 border-emerald-500/30 bg-emerald-500/5 text-[11px]"
        >
          {req.status}
        </Badge>
      </div>

      {/* Funding progress */}
      <div className="space-y-1">
        <div className="flex justify-between text-[11px] text-slate-500">
          <span>Собрано: {formatLzt(req.fundedAmountLzt)} LZT ({fundedPct}%)</span>
          <span>Осталось: {formatLzt(remaining)} LZT</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${fundedPct}%`,
              background: fundedPct >= 100 ? "#10b981" : "#0ea5e9",
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <TrendingUp className="w-3 h-3 text-amber-400" />
          {ratePercent}% / год
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-sky-400" />
          {req.termDays} дней
        </span>
      </div>

      <div className="pt-1">
        <Button
          size="sm"
          className="w-full font-semibold"
          style={{ background: "#0ea5e9", color: "#fff" }}
          onClick={() => onFund(req)}
          disabled={!myToken}
        >
          <HandCoins className="w-3.5 h-3.5 mr-2" />
          Дать в долг
        </Button>
        {!myToken && (
          <p className="text-[10px] text-slate-500 text-center mt-1">
            Войди, чтобы финансировать
          </p>
        )}
      </div>
    </div>
  );
}

function FundModal({
  req,
  onClose,
  myToken,
}: {
  req: LoanRequest | null;
  onClose: () => void;
  myToken: string;
}) {
  const qc = useQueryClient();
  const [source, setSource] = useState<"cash" | "balance">("cash");
  const [amount, setAmount] = useState("");
  const [amountError, setAmountError] = useState("");
  const [serverError, setServerError] = useState("");
  const fundMutation = useFundLoanRequest();

  const remaining = req ? req.amountLzt - req.fundedAmountLzt : 0;

  function handleFund() {
    if (!req) return;
    setServerError("");
    setAmountError("");

    let amountLzt: number | undefined;
    if (amount.trim() !== "") {
      const parsed = Math.floor(Number(amount));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setAmountError("Введи положительное число");
        return;
      }
      if (parsed > remaining) {
        setAmountError(`Максимум ${formatLzt(remaining)} LZT (остаток)`);
        return;
      }
      amountLzt = parsed;
    }

    fundMutation.mutate(
      {
        id: req.id,
        data: {
          userToken: myToken,
          source,
          payoutMode: "cash_on_close",
          ...(amountLzt !== undefined ? { amountLzt } : {}),
        },
      },
      {
        onSuccess: () => {
          toast.success("Заявка профинансирована!");
          qc.invalidateQueries({ queryKey: getListLoanRequestsQueryKey() });
          qc.invalidateQueries({ queryKey: getListMyLoansQueryKey({ userToken: myToken }) });
          qc.invalidateQueries({ queryKey: getGetWalletQueryKey(myToken) });
          setAmount("");
          onClose();
        },
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Ошибка";
          setServerError(serverErrorToRu(msg));
        },
      },
    );
  }

  return (
    <Dialog open={!!req} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        style={{ background: "#0a1018", border: "1px solid rgba(255,255,255,0.08)" }}
        className="text-slate-200 max-w-sm"
      >
        <DialogHeader>
          <DialogTitle className="text-white">Дать в долг</DialogTitle>
          <DialogDescription className="text-slate-400 text-xs">
            Заявка на{" "}
            <span className="text-white font-semibold">{formatLzt(req?.amountLzt ?? 0)} LZT</span>{" "}
            (осталось профинансировать:{" "}
            <span className="text-sky-400 font-semibold">{formatLzt(remaining)} LZT</span>
            ), ставка{" "}
            <span className="text-amber-400">{bpsToPercent(req?.rateBps ?? 0)}% / год</span>,{" "}
            срок{" "}
            <span className="text-sky-400">{req?.termDays} дней</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-400">
              Сумма (LZT){" "}
              <span className="text-slate-600">— оставь пустым, чтобы профинансировать весь остаток</span>
            </Label>
            <div className="flex gap-2">
              <Input
                type="number"
                step="1"
                min="1"
                placeholder={`до ${formatLzt(remaining)}`}
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setAmountError("");
                }}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: amountError ? "1px solid #ef4444" : "1px solid rgba(255,255,255,0.08)",
                  color: "#e2e8f0",
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-sky-400 hover:text-sky-300 px-2 shrink-0"
                onClick={() => { setAmount(String(remaining)); setAmountError(""); }}
              >
                МАКС
              </Button>
            </div>
            {amountError && (
              <p className="text-[11px] text-red-400">{amountError}</p>
            )}
          </div>

          <p className="text-xs text-slate-500">Откуда списать сумму:</p>
          <div className="grid grid-cols-2 gap-2">
            {(["cash", "balance"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSource(s)}
                className="rounded-lg p-3 text-sm font-semibold transition-all text-left"
                style={{
                  background: source === s ? "rgba(14,165,233,0.1)" : "rgba(255,255,255,0.02)",
                  border: source === s ? "2px solid #0ea5e9" : "2px solid rgba(255,255,255,0.06)",
                  color: source === s ? "#38bdf8" : "#94a3b8",
                }}
              >
                {s === "cash" ? "К выводу (cash)" : "Игровой (balance)"}
              </button>
            ))}
          </div>

          <div
            className="rounded-lg p-3 text-xs text-slate-400"
            style={{ background: "rgba(14,165,233,0.05)", border: "1px solid rgba(14,165,233,0.15)" }}
          >
            Платформенный сбор 2% списывается с заёмщика. Возврат идёт после погашения займа.
          </div>

          {serverError && (
            <div className="flex items-start gap-2 rounded-lg p-3 text-xs text-red-400"
              style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              {serverError}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            Отмена
          </Button>
          <Button
            size="sm"
            className="font-bold"
            style={{ background: "#0ea5e9", color: "#fff" }}
            onClick={handleFund}
            disabled={fundMutation.isPending}
          >
            {fundMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            Подтвердить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OpenRequestsSection({ myToken }: { myToken: string | null }) {
  const { data, isLoading } = useListLoanRequests({
    query: { queryKey: getListLoanRequestsQueryKey(), refetchInterval: 30_000 },
  });
  const [fundTarget, setFundTarget] = useState<LoanRequest | null>(null);

  if (isLoading) {
    return (
      <div className="grid sm:grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
      </div>
    );
  }

  const requests = data ?? [];

  return (
    <div className="space-y-4">
      {requests.length === 0 ? (
        <div
          className="rounded-xl py-12 text-center"
          style={{ border: "1px dashed rgba(255,255,255,0.08)" }}
        >
          <HandCoins className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Открытых заявок пока нет</p>
          <p className="text-slate-600 text-xs mt-1">Стань первым — создай заявку ниже</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {requests.map((r) => (
            <LoanRequestCard
              key={r.id}
              req={r}
              myToken={myToken}
              onFund={setFundTarget}
            />
          ))}
        </div>
      )}

      {myToken && (
        <FundModal
          req={fundTarget}
          onClose={() => setFundTarget(null)}
          myToken={myToken}
        />
      )}
    </div>
  );
}

function CreateRequestSection({ myToken }: { myToken: string | null }) {
  const qc = useQueryClient();
  const [amountLzt, setAmountLzt] = useState("");
  const [termDays, setTermDays] = useState("");
  const [ratePct, setRatePct] = useState("0");
  const [serverError, setServerError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const createMutation = useCreateLoanRequest();

  function validate() {
    const errs: Record<string, string> = {};
    const amt = parseInt(amountLzt, 10);
    const term = parseInt(termDays, 10);
    const rate = parseFloat(ratePct);

    if (!amountLzt || !Number.isFinite(amt) || amt <= 0) {
      errs.amountLzt = "Укажи положительную сумму LZT";
    }
    if (!termDays || !Number.isFinite(term) || term < 1) {
      errs.termDays = "Минимум 1 день";
    } else if (term > 365) {
      errs.termDays = "Максимум 365 дней";
    }
    if (!Number.isFinite(rate) || rate < 0) {
      errs.ratePct = "Ставка должна быть ≥ 0%";
    } else if (rate > 50) {
      errs.ratePct = "Максимум 50% годовых";
    }
    return errs;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!myToken) return;

    setServerError("");
    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const rateBps = Math.round(parseFloat(ratePct) * 100);
    createMutation.mutate(
      {
        data: {
          userToken: myToken,
          amountLzt: parseInt(amountLzt, 10),
          termDays: parseInt(termDays, 10),
          rateBps,
        },
      },
      {
        onSuccess: () => {
          toast.success("Заявка создана и появилась в списке открытых");
          setAmountLzt("");
          setTermDays("");
          setRatePct("0");
          setFieldErrors({});
          qc.invalidateQueries({ queryKey: getListLoanRequestsQueryKey() });
          qc.invalidateQueries({ queryKey: getListMyLoansQueryKey({ userToken: myToken }) });
        },
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Ошибка";
          setServerError(serverErrorToRu(msg));
        },
      },
    );
  }

  if (!myToken) {
    return (
      <div
        className="rounded-xl py-10 text-center"
        style={{ border: "1px dashed rgba(255,255,255,0.08)" }}
      >
        <Wallet className="w-8 h-8 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-500 text-sm">Войди как хост, чтобы создать заявку</p>
      </div>
    );
  }

  return (
    <Card style={{ background: "#0a1018", border: "1px solid rgba(255,255,255,0.06)" }}>
      <CardHeader className="pb-3">
        <CardTitle className="text-white text-base flex items-center gap-2">
          <Plus className="w-4 h-4 text-sky-400" />
          Новая заявка
        </CardTitle>
        <CardDescription className="text-slate-500 text-xs">
          Минимальный срок — {MIN_TERM_DAYS} дней. Платформа берёт 2% с суммы при фондировании.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400" htmlFor="loan-amount">
                Сумма (LZT)
              </Label>
              <Input
                id="loan-amount"
                type="number"
                step="1"
                min="1"
                placeholder="5000"
                value={amountLzt}
                onChange={(e) => {
                  setAmountLzt(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, amountLzt: "" }));
                }}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: fieldErrors.amountLzt ? "1px solid #ef4444" : "1px solid rgba(255,255,255,0.08)",
                  color: "#e2e8f0",
                }}
              />
              {fieldErrors.amountLzt && (
                <p className="text-[11px] text-red-400">{fieldErrors.amountLzt}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400" htmlFor="loan-term">
                Срок (дней)
              </Label>
              <Input
                id="loan-term"
                type="number"
                step="1"
                min="1"
                max="365"
                placeholder="90"
                value={termDays}
                onChange={(e) => {
                  setTermDays(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, termDays: "" }));
                }}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: fieldErrors.termDays ? "1px solid #ef4444" : "1px solid rgba(255,255,255,0.08)",
                  color: "#e2e8f0",
                }}
              />
              {fieldErrors.termDays && (
                <p className="text-[11px] text-red-400">{fieldErrors.termDays}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400" htmlFor="loan-rate">
                Ставка (% / год)
              </Label>
              <Input
                id="loan-rate"
                type="number"
                step="0.1"
                min="0"
                max="50"
                placeholder="5"
                value={ratePct}
                onChange={(e) => {
                  setRatePct(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, ratePct: "" }));
                }}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: fieldErrors.ratePct ? "1px solid #ef4444" : "1px solid rgba(255,255,255,0.08)",
                  color: "#e2e8f0",
                }}
              />
              {fieldErrors.ratePct && (
                <p className="text-[11px] text-red-400">{fieldErrors.ratePct}</p>
              )}
            </div>
          </div>

          {serverError && (
            <div
              className="flex items-start gap-2 rounded-lg p-3 text-xs text-red-400"
              style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)" }}
            >
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              {serverError}
            </div>
          )}

          <Button
            type="submit"
            className="font-bold"
            style={{ background: "#0ea5e9", color: "#fff" }}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            Разместить заявку
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function LoanStatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    active: { bg: "rgba(16,185,129,0.08)", text: "#34d399", border: "rgba(16,185,129,0.3)" },
    repaid: { bg: "rgba(14,165,233,0.08)", text: "#38bdf8", border: "rgba(14,165,233,0.3)" },
    defaulted: { bg: "rgba(239,68,68,0.08)", text: "#f87171", border: "rgba(239,68,68,0.3)" },
  };
  const c = colors[status] ?? { bg: "rgba(255,255,255,0.04)", text: "#94a3b8", border: "rgba(255,255,255,0.1)" };
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
    >
      {status}
    </span>
  );
}

function BorrowerCard({
  loan,
  myToken,
}: {
  loan: Loan;
  myToken: string;
}) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState("");
  const repayMutation = useRepayLoan();

  const isRepayable = loan.status === "active" || loan.status === "defaulted";

  function handleRepay() {
    const amt = parseInt(amount, 10);
    if (!Number.isFinite(amt) || amt <= 0) {
      setServerError("Введи положительную сумму");
      return;
    }
    setServerError("");
    repayMutation.mutate(
      { id: loan.id, data: { userToken: myToken, amountLzt: amt, source: "cash" } },
      {
        onSuccess: ({ repaidLzt }) => {
          toast.success(`Погашено ${formatLzt(repaidLzt)} LZT`);
          setOpen(false);
          setAmount("");
          qc.invalidateQueries({ queryKey: getListMyLoansQueryKey({ userToken: myToken }) });
          qc.invalidateQueries({ queryKey: getGetWalletQueryKey(myToken) });
        },
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Ошибка";
          setServerError(serverErrorToRu(msg));
        },
      },
    );
  }

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-xl font-bold text-white tabular-nums">
            {formatLzt(loan.outstandingLzt)}
          </span>
          <span className="text-xs text-slate-400 ml-1.5">LZT осталось</span>
        </div>
        <LoanStatusBadge status={loan.status} />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>Тело: {formatLzt(loan.principalLzt)} LZT</span>
        <span>Ставка: {bpsToPercent(loan.rateBps)}%/год</span>
        {loan.dueAt && (
          <span>До: {new Date(loan.dueAt).toLocaleDateString("ru-RU")}</span>
        )}
      </div>

      {isRepayable && (
        <>
          {!open ? (
            <Button
              size="sm"
              variant="outline"
              className="w-full font-semibold border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
              onClick={() => setOpen(true)}
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
              Погасить
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="1"
                  min="1"
                  placeholder={`макс ${formatLzt(loan.outstandingLzt)}`}
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setServerError("");
                  }}
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#e2e8f0",
                    fontSize: "0.8rem",
                  }}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-slate-400 hover:text-white px-2"
                  onClick={() => setAmount(String(loan.outstandingLzt))}
                >
                  МАКС
                </Button>
              </div>
              {serverError && (
                <p className="text-[11px] text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {serverError}
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 font-semibold"
                  style={{ background: "#10b981", color: "#fff" }}
                  onClick={handleRepay}
                  disabled={repayMutation.isPending}
                >
                  {repayMutation.isPending && (
                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  )}
                  Подтвердить
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-slate-500 hover:text-white"
                  onClick={() => {
                    setOpen(false);
                    setAmount("");
                    setServerError("");
                  }}
                >
                  Отмена
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LenderCard({ loan }: { loan: Loan }) {
  return (
    <div
      className="rounded-xl p-4 space-y-2"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-xl font-bold text-white tabular-nums">
            {formatLzt(loan.outstandingLzt)}
          </span>
          <span className="text-xs text-slate-400 ml-1.5">LZT к получению</span>
        </div>
        <LoanStatusBadge status={loan.status} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>Тело: {formatLzt(loan.principalLzt)} LZT</span>
        <span>Ставка: {bpsToPercent(loan.rateBps)}%/год</span>
        <span>Режим: {loan.lenderPayoutMode === "cash_on_close" ? "по закрытию" : "стриминг"}</span>
        {loan.dueAt && (
          <span>До: {new Date(loan.dueAt).toLocaleDateString("ru-RU")}</span>
        )}
      </div>
    </div>
  );
}

function MyDealsSection({ myToken }: { myToken: string | null }) {
  const { data, isLoading } = useListMyLoans(
    { userToken: myToken ?? "" },
    {
      query: {
        enabled: !!myToken,
        queryKey: getListMyLoansQueryKey({ userToken: myToken ?? "" }),
        refetchInterval: 30_000,
      },
    },
  );

  if (!myToken) {
    return (
      <div
        className="rounded-xl py-10 text-center"
        style={{ border: "1px dashed rgba(255,255,255,0.08)" }}
      >
        <Wallet className="w-8 h-8 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-500 text-sm">Войди, чтобы увидеть свои сделки</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => <Skeleton key={i} className="h-28 w-full" />)}
      </div>
    );
  }

  const asBorrower = data?.asBorrower ?? [];
  const asLender = data?.asLender ?? [];

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-semibold text-white">Я должен</span>
          <Badge variant="outline" className="text-[11px] border-white/10 text-slate-500">
            {asBorrower.length}
          </Badge>
        </div>
        {asBorrower.length === 0 ? (
          <p className="text-slate-600 text-xs py-4 text-center">Нет активных займов</p>
        ) : (
          asBorrower.map((loan) => (
            <BorrowerCard key={loan.id} loan={loan} myToken={myToken} />
          ))
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-semibold text-white">Мне должны</span>
          <Badge variant="outline" className="text-[11px] border-white/10 text-slate-500">
            {asLender.length}
          </Badge>
        </div>
        {asLender.length === 0 ? (
          <p className="text-slate-600 text-xs py-4 text-center">Нет активных позиций</p>
        ) : (
          asLender.map((loan) => <LenderCard key={loan.id} loan={loan} />)
        )}
      </div>
    </div>
  );
}

export default function ExchangePage() {
  const { hostToken } = useAuth();
  const { playerWalletToken } = usePlayerWallet();
  const myToken = playerWalletToken ?? hostToken ?? null;

  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(180deg,#060b10 0%,#080e16 100%)" }}
    >
      <SiteNav activePath="/exchange" />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#0ea5e9,#6366f1)" }}
            >
              <ArrowLeftRight className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">Биржа</h1>
          </div>
          <p className="text-sm text-slate-500 pl-11">P2P-кредитование и финансовые инструменты</p>
        </div>

        <Tabs defaultValue="credits" className="space-y-6">
          <TabsList
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
            className="h-10"
          >
            <TabsTrigger
              value="credits"
              className="data-[state=active]:bg-sky-500/15 data-[state=active]:text-sky-300 text-slate-400 text-sm"
            >
              Кредиты
            </TabsTrigger>
          </TabsList>

          <TabsContent value="credits" className="space-y-8 mt-0">
            <section>
              <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <HandCoins className="w-4 h-4 text-sky-400" />
                Открытые заявки
              </h2>
              <OpenRequestsSection myToken={myToken} />
            </section>

            <section>
              <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4 text-sky-400" />
                Создать заявку
              </h2>
              <CreateRequestSection myToken={myToken} />
            </section>

            <section>
              <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-sky-400" />
                Мои сделки
              </h2>
              <MyDealsSection myToken={myToken} />
            </section>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
