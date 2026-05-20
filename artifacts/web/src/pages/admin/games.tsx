import { useState } from "react";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { CheckCircle, XCircle, Clock, ChevronDown, ChevronUp } from "lucide-react";

type Submission = {
  id: string;
  hostId: string;
  status: string;
  title: string;
  slug: string;
  category: string;
  genres: string[];
  description: string;
  coverImageUrl: string;
  kind: string;
  defaultBrowserUrl: string;
  steamAppId: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  approvedGameId: string | null;
  createdAt: string;
  submitterDisplayName: string;
};


async function approveSubmission(
  id: string,
  hostToken: string,
): Promise<{ error?: string; game?: { slug: string } }> {
  const r = await fetch(
    `${import.meta.env.BASE_URL}api/admin/games/submissions/${id}/approve`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Host-Token": hostToken },
      body: JSON.stringify({}),
    },
  );
  return r.json();
}

async function rejectSubmission(
  id: string,
  reason: string,
  hostToken: string,
): Promise<{ error?: string }> {
  const r = await fetch(
    `${import.meta.env.BASE_URL}api/admin/games/submissions/${id}/reject`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Host-Token": hostToken },
      body: JSON.stringify({ reason }),
    },
  );
  return r.json();
}

function SubmissionCard({
  sub,
  hostToken,
  onAction,
}: {
  sub: Submission;
  hostToken: string;
  onAction: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);

  const handleApprove = async () => {
    setBusy(true);
    try {
      const res = await approveSubmission(sub.id, hostToken);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`Игра одобрена: ${res.game?.slug}`);
        onAction();
      }
    } catch {
      toast.error("Ошибка при одобрении");
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
      const res = await rejectSubmission(sub.id, rejectReason, hostToken);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Заявка отклонена");
        onAction();
      }
    } catch {
      toast.error("Ошибка при отклонении");
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
                  className="flex-1 h-8 px-3 rounded-md text-xs"
                  style={{
                    background: "#0d1823",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#e2e8f0",
                  }}
                />
                <Button
                  size="sm"
                  onClick={handleReject}
                  disabled={busy || !rejectReason.trim()}
                  className="h-8 text-xs font-semibold"
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

export default function AdminGamesPage() {
  const { hostToken } = useAuth();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [submissions, setSubmissions] = useState<Submission[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSubmissions = async (token: string, status: string) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(
        `${import.meta.env.BASE_URL}api/admin/games/submissions?status=${status}`,
        { headers: { "X-Host-Token": token } },
      );
      const data = await r.json();
      if (data.error) {
        setError(data.error);
        setSubmissions(null);
      } else {
        setSubmissions(data);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch when hostToken is available.
  if (hostToken && submissions === null && !loading && !error) {
    fetchSubmissions(hostToken, statusFilter);
  }

  const handleFilterChange = (s: string) => {
    setStatusFilter(s);
    setSubmissions(null);
    setError(null);
    if (hostToken) fetchSubmissions(hostToken, s);
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

  return (
    <div className="min-h-screen text-slate-300" style={{ background: "#06090e" }}>
      <SiteNav activePath="/admin/games" />
      <main className="max-w-3xl mx-auto px-6 pt-10 pb-16">
        <h1 className="text-2xl font-extrabold tracking-tight text-white mb-1">
          Модерация игр
        </h1>
        <p className="text-sm text-slate-500 mb-8">
          Заявки хостов на добавление новых игр в каталог.
        </p>

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

        {loading && (
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

        {error && (
          <div
            className="rounded-xl p-6 text-center text-sm"
            style={{ background: "#0a1018", color: "#f87171" }}
          >
            {error === "Admin access required"
              ? "У тебя нет прав администратора."
              : error}
          </div>
        )}

        {!loading && !error && submissions !== null && (
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
                    hostToken={hostToken}
                    onAction={() => {
                      setSubmissions(null);
                      fetchSubmissions(hostToken, statusFilter);
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
