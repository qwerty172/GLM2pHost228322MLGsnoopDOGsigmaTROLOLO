import { useMemo, useState } from "react";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  getAdminListGameSubmissionsQueryKey,
  getAdminListGamesQueryKey,
  useAdminApproveGameSubmission,
  useAdminDeleteGame,
  useAdminListGameSubmissions,
  useAdminListGames,
  useAdminPatchGame,
  useAdminRejectGameSubmission,
} from "@workspace/api-client-react";
import type {
  AdminListGameSubmissionsStatus,
  GameListItem,
  GameSubmissionListItem,
} from "@workspace/api-client-react";
import {
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Trash2,
  Gamepad2,
} from "lucide-react";

const ADMIN_SECRET_KEY = "streamline.adminSecret";

function readAdminSecret(): string {
  try {
    return sessionStorage.getItem(ADMIN_SECRET_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeAdminSecret(value: string): void {
  try {
    if (value) sessionStorage.setItem(ADMIN_SECRET_KEY, value);
    else sessionStorage.removeItem(ADMIN_SECRET_KEY);
  } catch {
    /* sessionStorage unavailable */
  }
  try {
    localStorage.removeItem(ADMIN_SECRET_KEY);
  } catch {
    /* ignore */
  }
}

function adminHeaders(hostToken: string): Record<string, string> {
  const secret = readAdminSecret();
  return {
    "X-Host-Token": hostToken,
    ...(secret ? { "X-Admin-Secret": secret } : {}),
  };
}

function formatAdminError(error: unknown): string {
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data: { error?: string; message?: string } | null }).data;
    const code = data?.error ?? data?.message;
    if (code === "Admin access required") {
      return "У тебя нет прав администратора.";
    }
    if (code === "admin_secret_required") {
      return data?.message ?? "Требуется секрет администратора.";
    }
    return data?.message ?? data?.error ?? String(error);
  }
  return String(error);
}

function CatalogGameRow({
  game,
  onToggle,
  onDelete,
}: {
  game: GameListItem;
  onToggle: (id: string, isHidden: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleToggle = async () => {
    setBusy(true);
    try {
      await onToggle(game.id, game.isHidden ?? false);
      toast.success(
        game.isHidden ? `«${game.title}» показана` : `«${game.title}» скрыта`,
      );
    } catch (err) {
      toast.error(formatAdminError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await onDelete(game.id);
      toast.success(`«${game.title}» удалена`);
    } catch (err) {
      toast.error(formatAdminError(err));
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{
        background: game.isHidden ? "rgba(10,16,24,0.5)" : "#0a1018",
        border: "1px solid rgba(255,255,255,0.07)",
        opacity: game.isHidden ? 0.65 : 1,
      }}
    >
      {game.coverImageUrl ? (
        <img
          src={
            game.coverImageUrl.startsWith("/api")
              ? `${import.meta.env.BASE_URL}${game.coverImageUrl.replace(/^\//, "")}`
              : game.coverImageUrl
          }
          alt={game.title}
          className="w-10 h-12 object-cover rounded flex-shrink-0"
          style={{ background: "#0d1823" }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <div
          className="w-10 h-12 rounded flex-shrink-0 flex items-center justify-center"
          style={{ background: "#0d1823" }}
        >
          <Gamepad2 className="h-4 w-4 text-slate-700" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white truncate">{game.title}</span>
          {game.isHidden && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide flex-shrink-0"
              style={{ background: "rgba(239,68,68,0.12)", color: "#f87171" }}
            >
              скрыта
            </span>
          )}
          {game.browserHostUrl && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide flex-shrink-0"
              style={{ background: "rgba(14,165,233,0.1)", color: "#38bdf8" }}
            >
              браузер
            </span>
          )}
        </div>
        <p className="text-xs text-slate-600 truncate">{game.genre || game.slug}</p>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {confirmDelete ? (
          <>
            <span className="text-xs text-red-400 mr-1">Удалить?</span>
            <Button
              size="sm"
              disabled={busy}
              onClick={handleDelete}
              className="h-7 px-2 text-[11px] font-semibold"
              style={{
                background: "rgba(239,68,68,0.2)",
                color: "#f87171",
                border: "1px solid rgba(239,68,68,0.4)",
              }}
            >
              Да
            </Button>
            <Button
              size="sm"
              disabled={busy}
              onClick={() => setConfirmDelete(false)}
              className="h-7 px-2 text-[11px] font-semibold"
              style={{
                background: "rgba(255,255,255,0.05)",
                color: "#94a3b8",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              Нет
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              disabled={busy}
              onClick={handleToggle}
              title={game.isHidden ? "Показать в каталоге" : "Скрыть из каталога"}
              className="h-7 w-7 p-0"
              style={{
                background: game.isHidden
                  ? "rgba(16,185,129,0.1)"
                  : "rgba(255,255,255,0.05)",
                color: game.isHidden ? "#34d399" : "#64748b",
                border: `1px solid ${game.isHidden ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.08)"}`,
              }}
            >
              {game.isHidden ? (
                <Eye className="h-3.5 w-3.5" />
              ) : (
                <EyeOff className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              size="sm"
              disabled={busy}
              onClick={() => setConfirmDelete(true)}
              title="Удалить из БД"
              className="h-7 w-7 p-0"
              style={{
                background: "rgba(239,68,68,0.08)",
                color: "#ef4444",
                border: "1px solid rgba(239,68,68,0.2)",
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function SubmissionCard({
  sub,
  onApprove,
  onReject,
}: {
  sub: GameSubmissionListItem;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string, reason: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);

  const handleApprove = async () => {
    setBusy(true);
    try {
      await onApprove(sub.id);
      toast.success(`Игра одобрена: ${sub.slug || sub.title}`);
    } catch (err) {
      toast.error(formatAdminError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error("Укажи причину отклонения");
      return;
    }
    setBusy(true);
    try {
      await onReject(sub.id, rejectReason.trim());
      toast.success("Заявка отклонена");
    } catch (err) {
      toast.error(formatAdminError(err));
    } finally {
      setBusy(false);
    }
  };

  const statusColor =
    sub.status === "pending"
      ? "#f59e0b"
      : sub.status === "approved"
        ? "#10b981"
        : "#ef4444";

  return (
    <div
      style={{
        background: "#0a1018",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 12,
        padding: 20,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          {sub.coverImageUrl ? (
            <img
              src={
                sub.coverImageUrl.startsWith("/api")
                  ? `${import.meta.env.BASE_URL}${sub.coverImageUrl.replace(/^\//, "")}`
                  : sub.coverImageUrl
              }
              alt={sub.title}
              className="w-16 h-20 object-cover rounded-md flex-shrink-0"
              style={{ background: "#0d1823" }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div
              className="w-16 h-20 rounded-md flex-shrink-0 flex items-center justify-center text-xs text-slate-600"
              style={{ background: "#0d1823" }}
            >
              нет
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-white font-bold text-base">{sub.title}</span>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide"
                style={{ background: `${statusColor}22`, color: statusColor }}
              >
                {sub.status === "pending"
                  ? "На рассмотрении"
                  : sub.status === "approved"
                    ? "Одобрено"
                    : "Отклонено"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              от{" "}
              <span className="text-slate-400">{sub.submitterDisplayName}</span>
              {" · "}
              {sub.kind === "browser" ? "Браузер" : "Нативный"}
              {sub.category ? ` · ${sub.category}` : ""}
            </p>
            {sub.genres.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {sub.genres.map((g) => (
                  <span
                    key={g}
                    className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{
                      background: "rgba(14,165,233,0.08)",
                      color: "#38bdf8",
                    }}
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="text-slate-500 hover:text-slate-300 flex-shrink-0"
        >
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 space-y-3">
          {sub.description && (
            <p className="text-sm text-slate-400">{sub.description}</p>
          )}
          {sub.steamAppId && (
            <p className="text-xs text-slate-500">
              Steam App ID:{" "}
              <span className="text-slate-300">{sub.steamAppId}</span>
            </p>
          )}
          {sub.rejectionReason && (
            <p className="text-xs text-red-400">
              Причина отклонения: {sub.rejectionReason}
            </p>
          )}

          {sub.status === "pending" && (
            <div className="flex flex-col gap-2 pt-2">
              <Button
                size="sm"
                onClick={handleApprove}
                disabled={busy}
                className="w-full h-8 text-xs font-semibold"
                style={{
                  background: "rgba(16,185,129,0.16)",
                  color: "#34d399",
                  border: "1px solid rgba(16,185,129,0.35)",
                }}
              >
                <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                Одобрить и добавить в каталог
              </Button>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Причина отклонения…"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="flex-1 h-8 px-3 text-xs rounded-lg text-slate-200 placeholder:text-slate-600 outline-none"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                />
                <Button
                  size="sm"
                  onClick={handleReject}
                  disabled={busy}
                  className="h-8 px-3 text-xs font-semibold flex-shrink-0"
                  style={{
                    background: "rgba(239,68,68,0.12)",
                    color: "#f87171",
                    border: "1px solid rgba(239,68,68,0.3)",
                  }}
                >
                  <XCircle className="mr-1 h-3.5 w-3.5" />
                  Отклонить
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type Tab = "catalog" | "submissions";

export default function AdminGamesPage() {
  const { hostToken } = useAuth();
  const [tab, setTab] = useState<Tab>("catalog");
  const [statusFilter, setStatusFilter] = useState<AdminListGameSubmissionsStatus>("pending");
  const [adminSecret, setAdminSecret] = useState(() => readAdminSecret());

  const adminRequest = useMemo(
    () => ({ headers: hostToken ? adminHeaders(hostToken) : undefined }),
    [hostToken, adminSecret],
  );

  const catalogQuery = useAdminListGames({
    request: adminRequest,
    query: {
      enabled: Boolean(hostToken) && tab === "catalog",
      queryKey: [...getAdminListGamesQueryKey(), adminSecret],
    },
  });

  const submissionsQuery = useAdminListGameSubmissions(
    { status: statusFilter },
    {
      request: adminRequest,
      query: {
        enabled: Boolean(hostToken) && tab === "submissions",
        queryKey: [...getAdminListGameSubmissionsQueryKey({ status: statusFilter }), adminSecret],
      },
    },
  );

  const patchGame = useAdminPatchGame({ request: adminRequest });
  const deleteGame = useAdminDeleteGame({ request: adminRequest });
  const approveSubmission = useAdminApproveGameSubmission({ request: adminRequest });
  const rejectSubmission = useAdminRejectGameSubmission({ request: adminRequest });

  const handleSecretChange = (value: string) => {
    setAdminSecret(value);
    writeAdminSecret(value);
  };

  const handleToggleVisibility = async (id: string, isHidden: boolean) => {
    await patchGame.mutateAsync({ id, data: { isHidden: !isHidden } });
    await catalogQuery.refetch();
  };

  const handleDeleteGame = async (id: string) => {
    await deleteGame.mutateAsync({ id });
    await catalogQuery.refetch();
  };

  const handleApprove = async (id: string) => {
    await approveSubmission.mutateAsync({ id, data: {} });
    await submissionsQuery.refetch();
  };

  const handleReject = async (id: string, reason: string) => {
    await rejectSubmission.mutateAsync({ id, data: { reason } });
    await submissionsQuery.refetch();
  };

  const handleFilterChange = (s: AdminListGameSubmissionsStatus) => {
    setStatusFilter(s);
  };

  if (!hostToken) {
    return (
      <div className="min-h-screen text-slate-300" style={{ background: "#06090e" }}>
        <SiteNav activePath="/admin/games" />
        <main className="max-w-3xl mx-auto px-6 pt-20 text-center">
          <p className="text-slate-500">Войди как хост, чтобы открыть панель администратора.</p>
        </main>
      </div>
    );
  }

  const catalogGames = catalogQuery.data;
  const catalogError = catalogQuery.error ? formatAdminError(catalogQuery.error) : null;
  const submissions = submissionsQuery.data;
  const submissionsError = submissionsQuery.error
    ? formatAdminError(submissionsQuery.error)
    : null;

  return (
    <div className="min-h-screen text-slate-300" style={{ background: "#06090e" }}>
      <SiteNav activePath="/admin/games" />
      <main className="max-w-3xl mx-auto px-6 pt-10 pb-16">
        <h1 className="text-2xl font-extrabold tracking-tight text-white mb-1">
          Управление играми
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          Каталог и заявки хостов на добавление новых игр.
        </p>

        <div className="mb-6">
          <label className="block text-xs font-medium text-slate-500 mb-1.5">
            Секрет администратора
          </label>
          <input
            type="password"
            value={adminSecret}
            onChange={(e) => handleSecretChange(e.target.value)}
            placeholder="Введите X-Admin-Secret…"
            autoComplete="off"
            className="w-full max-w-sm h-9 px-3 text-sm rounded-lg text-slate-200 placeholder:text-slate-600 outline-none focus:border-sky-600"
            style={{
              background: "#0a1018",
              border: "1px solid rgba(255,255,255,0.09)",
            }}
          />
          <p className="text-[11px] text-slate-600 mt-1">
            Требуется для всех действий на этой странице. Хранится в sessionStorage до закрытия вкладки.
          </p>
        </div>

        <div className="flex gap-2 mb-8 border-b border-white/[0.06] pb-0">
          {(["catalog", "submissions"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className="px-4 h-9 text-sm font-medium transition-colors border-b-2 -mb-px"
              style={{
                borderColor: tab === t ? "#0ea5e9" : "transparent",
                color: tab === t ? "#e2e8f0" : "#64748b",
              }}
            >
              {t === "catalog" ? "Каталог" : "Заявки"}
            </button>
          ))}
        </div>

        {tab === "catalog" && (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-slate-500">
                Все игры в БД — включая скрытые. Скрытые не отображаются у игроков.
              </p>
              <button
                type="button"
                className="text-xs text-sky-500 hover:text-sky-400"
                onClick={() => void catalogQuery.refetch()}
              >
                Обновить
              </button>
            </div>

            {catalogQuery.isLoading && (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-16 rounded-xl animate-pulse"
                    style={{ background: "#0a1018" }}
                  />
                ))}
              </div>
            )}

            {catalogError && (
              <div
                className="rounded-xl p-6 text-center text-sm"
                style={{ background: "#0a1018", color: "#f87171" }}
              >
                {catalogError}
              </div>
            )}

            {!catalogQuery.isLoading && !catalogError && catalogGames !== undefined && (
              <>
                {catalogGames.length === 0 ? (
                  <div
                    className="rounded-xl p-12 text-center"
                    style={{
                      background: "#0a1018",
                      border: "1px dashed rgba(255,255,255,0.08)",
                    }}
                  >
                    <Gamepad2 className="h-10 w-10 text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">Каталог пуст</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {catalogGames.map((game) => (
                      <CatalogGameRow
                        key={game.id}
                        game={game}
                        onToggle={handleToggleVisibility}
                        onDelete={handleDeleteGame}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {tab === "submissions" && (
          <>
            <div className="flex gap-2 mb-6">
              {(["pending", "approved", "rejected", "all"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleFilterChange(s)}
                  className="px-3 h-8 rounded-full text-xs font-medium transition-colors"
                  style={{
                    background:
                      statusFilter === s ? "#0ea5e9" : "rgba(14,165,233,0.06)",
                    color: statusFilter === s ? "#fff" : "#94a3b8",
                    border:
                      statusFilter === s
                        ? "1px solid #0ea5e9"
                        : "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {s === "pending"
                    ? "На рассмотрении"
                    : s === "approved"
                      ? "Одобренные"
                      : s === "rejected"
                        ? "Отклонённые"
                        : "Все"}
                </button>
              ))}
            </div>

            {submissionsQuery.isLoading && (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-24 rounded-xl animate-pulse"
                    style={{ background: "#0a1018" }}
                  />
                ))}
              </div>
            )}

            {submissionsError && (
              <div
                className="rounded-xl p-6 text-center text-sm"
                style={{ background: "#0a1018", color: "#f87171" }}
              >
                {submissionsError}
              </div>
            )}

            {!submissionsQuery.isLoading && !submissionsError && submissions !== undefined && (
              <>
                {submissions.length === 0 ? (
                  <div
                    className="rounded-xl p-12 text-center"
                    style={{
                      background: "#0a1018",
                      border: "1px dashed rgba(255,255,255,0.08)",
                    }}
                  >
                    <Clock className="h-10 w-10 text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">Заявок нет</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {submissions.map((sub) => (
                      <SubmissionCard
                        key={sub.id}
                        sub={sub}
                        onApprove={handleApprove}
                        onReject={handleReject}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
