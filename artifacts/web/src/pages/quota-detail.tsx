import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetQuota,
  usePublishQuota,
  usePauseQuota,
  useCloseQuota,
  useRegenerateQuotaCode,
  getGetQuotaQueryKey,
  getListMyQuotasQueryKey,
} from "@workspace/api-client-react";
import { toast } from "sonner";
import { SiteNav } from "@/components/site-nav";
import { useAuth } from "@/hooks/use-auth";
import { formatApiError } from "@/lib/api-errors";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Coins,
  Sparkles,
  Lock,
  Globe,
  Copy,
  Pause,
  Play,
  XCircle,
  RefreshCw,
  Pencil,
} from "lucide-react";

const cardStyle = {
  background: "#0a1018",
  border: "1px solid rgba(255,255,255,0.06)",
} as const;
const fmtLzt = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("ru-RU").format(n) + " LZT";

export default function QuotaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { hostToken } = useAuth();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const params = hostToken ? { ownerToken: hostToken } : {};
  const { data: quota, isLoading, refetch } = useGetQuota(id!, params);
  const publish = usePublishQuota();
  const pause = usePauseQuota();
  const close = useCloseQuota();
  const regen = useRegenerateQuotaCode();
  const [confirmingClose, setConfirmingClose] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen" style={{ background: "#06090e" }}>
        <SiteNav activePath="/quotas" />
        <main className="max-w-4xl mx-auto px-6 pt-10 text-slate-500">
          Загрузка…
        </main>
      </div>
    );
  }
  if (!quota) {
    return (
      <div className="min-h-screen" style={{ background: "#06090e" }}>
        <SiteNav activePath="/quotas" />
        <main className="max-w-4xl mx-auto px-6 pt-10 text-slate-500">
          Квота не найдена.
        </main>
      </div>
    );
  }

  const isOwner = quota.isOwner === true;
  const isRoyalty = quota.kind === "royalty";

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getGetQuotaQueryKey(id!, params) });
    qc.invalidateQueries({
      queryKey: getListMyQuotasQueryKey({ ownerToken: hostToken ?? "" }),
    });
    refetch();
  };

  const doPublish = async () => {
    if (!hostToken) return;
    try {
      await publish.mutateAsync({ id: id!, data: { ownerToken: hostToken } });
      toast.success("Квота опубликована");
      invalidate();
    } catch (err) {
      toast.error(formatApiError(err, "Ошибка"));
    }
  };
  const doPause = async () => {
    if (!hostToken) return;
    try {
      await pause.mutateAsync({ id: id!, data: { ownerToken: hostToken } });
      toast.success("Поставлено на паузу");
      invalidate();
    } catch (err) {
      toast.error(formatApiError(err, "Ошибка"));
    }
  };
  const doClose = async () => {
    if (!hostToken) return;
    try {
      await close.mutateAsync({ id: id!, data: { ownerToken: hostToken } });
      toast.success("Квота закрыта, эскроу возвращён");
      invalidate();
    } catch (err) {
      toast.error(formatApiError(err, "Ошибка"));
    }
  };
  const doRegen = async () => {
    if (!hostToken) return;
    try {
      await regen.mutateAsync({ id: id!, data: { ownerToken: hostToken } });
      toast.success("Новый код выпущен");
      invalidate();
    } catch (err) {
      toast.error(formatApiError(err, "Ошибка"));
    }
  };

  return (
    <div className="min-h-screen text-slate-300" style={{ background: "#06090e" }}>
      <SiteNav activePath="/quotas" />
      <main className="max-w-4xl mx-auto px-6 pt-10 pb-16 space-y-6">
        <Link href="/quotas">
          <span className="text-xs text-slate-500 hover:text-sky-400 cursor-pointer">
            ← К списку квот
          </span>
        </Link>

        <Card style={cardStyle}>
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              {isRoyalty ? (
                <Coins className="h-4 w-4 text-amber-400" />
              ) : (
                <Sparkles className="h-4 w-4 text-sky-400" />
              )}
              <span
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: isRoyalty ? "#fbbf24" : "#38bdf8" }}
              >
                {isRoyalty ? "Роялти" : "Спонсор"}
              </span>
              {quota.visibility === "private" ? (
                <Lock className="h-3 w-3 text-slate-500" />
              ) : (
                <Globe className="h-3 w-3 text-slate-500" />
              )}
              <span className="text-xs text-slate-500 ml-auto">
                {quota.status}
              </span>
            </div>
            <CardTitle className="text-2xl text-white">
              {quota.title}
            </CardTitle>
            <CardDescription className="text-slate-400 text-sm">
              {quota.description || "Без описания"}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            {isRoyalty ? (
              <>
                <Stat
                  label="Тариф"
                  value={
                    quota.royaltyBasis === "percent"
                      ? `${quota.royaltyValue ?? 0}% / мин`
                      : `${quota.royaltyValue ?? 0} LZT/мин`
                  }
                />
                <Stat
                  label="Откуда"
                  value={
                    quota.royaltySource === "player"
                      ? "Сверху с игрока"
                      : "Из доли хоста"
                  }
                />
              </>
            ) : (
              <>
                <Stat label="Бюджет" value={fmtLzt(quota.budgetLzt)} />
                <Stat
                  label="Остаток эскроу"
                  value={fmtLzt(quota.escrowRemainingLzt)}
                  highlight
                />
                <Stat
                  label="Хосту / мин"
                  value={fmtLzt(quota.sponsorHostPerMinuteLzt)}
                />
                <Stat
                  label="Игроку / мин"
                  value={fmtLzt(quota.sponsorPlayerPerMinuteLzt)}
                />
              </>
            )}
            {quota.gameTitle && <Stat label="Игра" value={quota.gameTitle} />}
            <Stat label="Автор" value={quota.ownerDisplayName} />
            {quota.endAt && (
              <Stat
                label="Конец действия"
                value={new Date(quota.endAt).toLocaleString("ru-RU")}
              />
            )}
          </CardContent>
        </Card>

        <Card style={cardStyle}>
          <CardHeader>
            <CardTitle className="text-white text-base">Статистика</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4 text-sm">
            <Stat
              label="Активных сессий"
              value={String(quota.activeSessionCount)}
            />
            <Stat
              label="Закрытых сессий"
              value={String(quota.closedSessionCount)}
            />
            <Stat label="Выплачено всего" value={fmtLzt(quota.totalPaidOutLzt)} />
          </CardContent>
        </Card>

        {isOwner && (
          <Card style={cardStyle}>
            <CardHeader>
              <CardTitle className="text-white text-base">
                Управление (только владелец)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {quota.visibility === "private" && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-amber-400/10 border border-amber-400/20">
                  <Lock className="h-4 w-4 text-amber-400" />
                  <span className="text-xs text-slate-400">Код доступа:</span>
                  <code
                    className="text-amber-300 font-bold font-mono"
                    data-testid="text-access-code"
                  >
                    {quota.accessCode}
                  </code>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="ml-auto h-7 px-2 text-slate-400"
                    onClick={() => {
                      navigator.clipboard.writeText(quota.accessCode ?? "");
                      toast.success("Скопировано");
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-slate-400"
                    onClick={doRegen}
                    disabled={regen.isPending}
                    data-testid="button-regen-code"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {quota.status === "draft" && (
                  <>
                    <Button
                      size="sm"
                      onClick={doPublish}
                      disabled={publish.isPending}
                      style={{ background: "#0ea5e9", color: "#fff" }}
                      data-testid="button-publish"
                    >
                      <Play className="h-3.5 w-3.5 mr-1.5" /> Опубликовать
                    </Button>
                    <Link href={`/quotas/${quota.id}/edit`}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-white/10 text-slate-300"
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1.5" /> Редактировать
                      </Button>
                    </Link>
                  </>
                )}
                {quota.status === "active" && (
                  <Button
                    size="sm"
                    onClick={doPause}
                    disabled={pause.isPending}
                    variant="outline"
                    className="border-amber-400/40 text-amber-300"
                    data-testid="button-pause"
                  >
                    <Pause className="h-3.5 w-3.5 mr-1.5" /> Пауза
                  </Button>
                )}
                {quota.status === "paused" && (
                  <Button
                    size="sm"
                    onClick={doPublish}
                    disabled={publish.isPending}
                    style={{ background: "#0ea5e9", color: "#fff" }}
                    data-testid="button-resume"
                  >
                    <Play className="h-3.5 w-3.5 mr-1.5" /> Возобновить
                  </Button>
                )}
                {!["closed", "expired"].includes(quota.status) && (
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!confirmingClose) {
                        setConfirmingClose(true);
                        setTimeout(() => setConfirmingClose(false), 4000);
                        return;
                      }
                      doClose();
                    }}
                    disabled={close.isPending}
                    variant="outline"
                    className="border-rose-400/40 text-rose-300"
                    data-testid="button-close"
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1.5" />
                    {confirmingClose ? "Подтвердить закрытие" : "Закрыть"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {quota.recentMovements.length > 0 && (
          <Card style={cardStyle}>
            <CardHeader>
              <CardTitle className="text-white text-base">
                Последние движения
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-white/5">
                {quota.recentMovements.slice(0, 20).map((m) => (
                  <li
                    key={m.id}
                    className="py-2 flex items-center justify-between text-xs"
                  >
                    <span className="text-slate-400 font-mono">
                      {m.kind.replace("quota_", "")}
                    </span>
                    <span className="text-slate-500">
                      {new Date(m.billedAt).toLocaleString("ru-RU")}
                    </span>
                    <span className="text-emerald-300 font-mono">
                      {fmtLzt(m.amountLzt)}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {!hostToken && (
          <Card style={cardStyle}>
            <CardContent className="py-4 text-xs text-slate-500">
              Войди в кабинет хоста, чтобы прикрепить эту квоту к своей сессии
              или, если ты автор, управлять ею.
            </CardContent>
          </Card>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="text-slate-500"
          onClick={() => navigate("/quotas")}
        >
          ← Все квоты
        </Button>
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div
        className={`mt-1 font-mono ${highlight ? "text-emerald-300 text-lg font-bold" : "text-white"}`}
      >
        {value}
      </div>
    </div>
  );
}
