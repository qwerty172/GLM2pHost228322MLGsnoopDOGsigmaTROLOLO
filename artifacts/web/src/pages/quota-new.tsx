import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  useCreateQuota,
  usePublishQuota,
  useListGames,
} from "@workspace/api-client-react";
import { SiteNav } from "@/components/site-nav";
import { useAuth } from "@/hooks/use-auth";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Coins, Sparkles, Loader2, Server, ChevronDown, ChevronRight, CheckCircle2, XCircle, Cpu, Wand2 } from "lucide-react";
import { QuotaAiChat, type QuotaFormPatch } from "@/components/quota-ai-chat";
import { VtScanner } from "@/components/vt-scanner";
import {
  clearQuotaFieldError,
  validateQuotaCreateForm,
  type QuotaFormFieldErrors,
} from "@/lib/quota-form-validation";

const cardStyle = {
  background: "#0a1018",
  border: "1px solid rgba(255,255,255,0.06)",
} as const;
const inputStyle = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#e2e8f0",
};

export default function QuotaNewPage() {
  const { hostToken } = useAuth();
  const [, navigate] = useLocation();

  const [kind, setKind] = useState<"royalty" | "sponsor">("royalty");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");

  const [royaltyBasis, setRoyaltyBasis] = useState<
    "percent" | "fixed_per_minute"
  >("percent");
  const [royaltyValue, setRoyaltyValue] = useState<number>(10);
  const [royaltySource, setRoyaltySource] = useState<"player" | "host_share">(
    "host_share",
  );

  const [budgetLzt, setBudgetLzt] = useState<number>(2000);
  const [sponsorHostPerMinute, setSponsorHostPerMinute] = useState<number>(8);
  const [sponsorPlayerPerMinute, setSponsorPlayerPerMinute] = useState<number>(0);

  const [gameId, setGameId] = useState<string>("");
  const [minSessionMinutes, setMinSessionMinutes] = useState<string>("");
  const [maxSessionMinutes, setMaxSessionMinutes] = useState<string>("");
  const [startAt, setStartAt] = useState<string>("");
  const [endAt, setEndAt] = useState<string>("");
  const [publishNow, setPublishNow] = useState<boolean>(true);

  const [vdsOpen, setVdsOpen] = useState(false);
  const [vdsProvider] = useState("ssh");
  const [vdsSshHost, setVdsSshHost] = useState("");
  const [vdsSshPort, setVdsSshPort] = useState("22");
  const [vdsSshUser, setVdsSshUser] = useState("root");
  const [vdsSshKey, setVdsSshKey] = useState("");
  const [vdsTestResult, setVdsTestResult] = useState<null | { ok: boolean; error?: string }>(null);
  const [vdsTesting, setVdsTesting] = useState(false);
  const [vdsSaving, setVdsSaving] = useState(false);

  // PC specs
  const [minGpuVram, setMinGpuVram] = useState<string>("");
  const [minCpuCores, setMinCpuCores] = useState<string>("");
  const [minRamGb, setMinRamGb] = useState<string>("");
  const [minDownloadMbps, setMinDownloadMbps] = useState<string>("");
  const [minUploadMbps, setMinUploadMbps] = useState<string>("");
  const [recGpuVram, setRecGpuVram] = useState<string>("");
  const [recCpuCores, setRecCpuCores] = useState<string>("");
  const [recRamGb, setRecRamGb] = useState<string>("");
  const [recDownloadMbps, setRecDownloadMbps] = useState<string>("");
  const [recUploadMbps, setRecUploadMbps] = useState<string>("");
  const [requiredTier, setRequiredTier] = useState<"min" | "recommended">("min");
  const [aiLoading, setAiLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string>("");
  const [fieldErrors, setFieldErrors] = useState<QuotaFormFieldErrors>({});

  const createQuota = useCreateQuota();
  const publishQuota = usePublishQuota();
  const { data: games } = useListGames({});

  const testVdsConnection = async () => {
    if (!vdsSshHost.trim() || !vdsSshUser.trim() || !vdsSshKey.trim()) {
      toast.error("Укажи SSH host, user и ключ");
      return;
    }
    if (!hostToken) {
      toast.error("Нужна авторизация хоста");
      return;
    }
    setVdsTesting(true);
    setVdsTestResult(null);
    try {
      const res = await fetch(
        `${import.meta.env.BASE_URL}api/quotas/vds/test-connection`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ownerToken: hostToken,
            sshHost: vdsSshHost.trim(),
            sshPort: Number(vdsSshPort) || 22,
            sshUser: vdsSshUser.trim(),
            sshKey: vdsSshKey,
          }),
        },
      );
      const data = (await res.json()) as { ok: boolean; error?: string };
      setVdsTestResult(data);
    } catch {
      setVdsTestResult({ ok: false, error: "Ошибка сети" });
    } finally {
      setVdsTesting(false);
    }
  };

  const saveVdsConfig = async (quotaId: string) => {
    if (!hostToken || !vdsSshHost.trim() || !vdsSshKey.trim()) return;
    setVdsSaving(true);
    try {
      const res = await fetch(
        `${import.meta.env.BASE_URL}api/quotas/${quotaId}/vds`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ownerToken: hostToken,
            provider: vdsProvider,
            sshHost: vdsSshHost.trim(),
            sshPort: Number(vdsSshPort) || 22,
            sshUser: vdsSshUser.trim(),
            sshKey: vdsSshKey,
          }),
        },
      );
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        toast.error(d.error ?? "Не удалось сохранить VDS-конфиг");
      } else {
        toast.success("VDS-конфиг сохранён, провижининг запущен");
      }
    } catch {
      toast.error("Ошибка сети при сохранении VDS");
    } finally {
      setVdsSaving(false);
    }
  };

  const selectedGame = games?.find((g) => g.id === gameId);

  const handleAiSuggest = async () => {
    setAiLoading(true);
    try {
      const body: { gameTitle?: string; genre?: string } = {};
      if (selectedGame) {
        body.gameTitle = selectedGame.title;
      }
      const resp = await fetch(
        `${import.meta.env.BASE_URL}api/quotas/ai-suggest-specs`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!resp.ok) {
        const err = (await resp.json()) as { error?: string };
        toast.error(err.error ?? "AI вернул ошибку");
        return;
      }
      const data = (await resp.json()) as {
        minGpuVram: number;
        minCpuCores: number;
        minRamGb: number;
        minDownloadMbps: number;
        minUploadMbps: number;
        recGpuVram: number;
        recCpuCores: number;
        recRamGb: number;
        recDownloadMbps: number;
        recUploadMbps: number;
      };
      setMinGpuVram(String(data.minGpuVram));
      setMinCpuCores(String(data.minCpuCores));
      setMinRamGb(String(data.minRamGb));
      setMinDownloadMbps(String(data.minDownloadMbps));
      setMinUploadMbps(String(data.minUploadMbps));
      setRecGpuVram(String(data.recGpuVram));
      setRecCpuCores(String(data.recCpuCores));
      setRecRamGb(String(data.recRamGb));
      setRecDownloadMbps(String(data.recDownloadMbps));
      setRecUploadMbps(String(data.recUploadMbps));
      toast.success("ИИ подобрал минимальные и рекомендуемые требования");
    } catch {
      toast.error("Не удалось подключиться к ИИ");
    } finally {
      setAiLoading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostToken) {
      toast.error("Нужно войти как хост");
      return;
    }

    const validation = validateQuotaCreateForm({
      kind,
      title,
      royaltyBasis,
      royaltyValue,
      royaltySource,
      budgetLzt,
      sponsorHostPerMinute,
      sponsorPlayerPerMinute,
      minSessionMinutes,
      maxSessionMinutes,
      startAt,
      endAt,
      minGpuVram,
      minCpuCores,
      minRamGb,
      minDownloadMbps,
      minUploadMbps,
      recGpuVram,
      recCpuCores,
      recRamGb,
      recDownloadMbps,
      recUploadMbps,
    });
    if (!validation.ok) {
      setFieldErrors(validation.errors);
      toast.error(validation.firstError);
      return;
    }
    setFieldErrors({});

    try {
      const created = await createQuota.mutateAsync({
        data: {
          ownerToken: hostToken,
          kind,
          title: title.trim(),
          description,
          visibility,
          gameId: gameId || null,
          minSessionMinutes: minSessionMinutes
            ? Math.max(1, Math.floor(Number(minSessionMinutes)))
            : null,
          maxSessionMinutes: maxSessionMinutes
            ? Math.max(1, Math.floor(Number(maxSessionMinutes)))
            : null,
          startAt: startAt ? new Date(startAt).toISOString() : null,
          endAt: endAt ? new Date(endAt).toISOString() : null,
          royaltyBasis: kind === "royalty" ? royaltyBasis : null,
          royaltyValue: kind === "royalty" ? Math.floor(royaltyValue) : null,
          royaltySource: kind === "royalty" ? royaltySource : null,
          budgetLzt: kind === "sponsor" ? Math.floor(budgetLzt) : null,
          sponsorHostPerMinuteLzt:
            kind === "sponsor" ? Math.floor(sponsorHostPerMinute) : null,
          sponsorPlayerPerMinuteLzt:
            kind === "sponsor" ? Math.floor(sponsorPlayerPerMinute) : null,
          minGpuVram: minGpuVram ? Math.floor(Number(minGpuVram)) : null,
          minCpuCores: minCpuCores ? Math.floor(Number(minCpuCores)) : null,
          minRamGb: minRamGb ? Math.floor(Number(minRamGb)) : null,
          minDownloadMbps: minDownloadMbps ? Math.floor(Number(minDownloadMbps)) : null,
          minUploadMbps: minUploadMbps ? Math.floor(Number(minUploadMbps)) : null,
          recGpuVram: recGpuVram ? Math.floor(Number(recGpuVram)) : null,
          recCpuCores: recCpuCores ? Math.floor(Number(recCpuCores)) : null,
          recRamGb: recRamGb ? Math.floor(Number(recRamGb)) : null,
          recDownloadMbps: recDownloadMbps ? Math.floor(Number(recDownloadMbps)) : null,
          recUploadMbps: recUploadMbps ? Math.floor(Number(recUploadMbps)) : null,
          requiredTier,
          apiKey: apiKey.trim() || null,
        },
      });
      toast.success("Черновик создан");

      if (vdsOpen && vdsSshHost.trim() && vdsSshKey.trim()) {
        await saveVdsConfig(created.id);
      }

      if (publishNow) {
        try {
          await publishQuota.mutateAsync({
            id: created.id,
            data: { ownerToken: hostToken },
          });
          toast.success("Квота опубликована");
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : "Не удалось опубликовать",
          );
        }
      }
      navigate(`/quotas/${created.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    }
  };

  const handleAiPatch = (patch: QuotaFormPatch) => {
    if (patch.kind && (patch.kind === "royalty" || patch.kind === "sponsor")) setKind(patch.kind);
    if (patch.title !== undefined) setTitle(patch.title);
    if (patch.description !== undefined) setDescription(patch.description);
    if (patch.visibility && (patch.visibility === "public" || patch.visibility === "private")) setVisibility(patch.visibility);
    if (patch.royaltyBasis && (patch.royaltyBasis === "percent" || patch.royaltyBasis === "fixed_per_minute")) setRoyaltyBasis(patch.royaltyBasis);
    if (patch.royaltyValue !== undefined) setRoyaltyValue(patch.royaltyValue);
    if (patch.royaltySource && (patch.royaltySource === "player" || patch.royaltySource === "host_share")) setRoyaltySource(patch.royaltySource);
    if (patch.budgetLzt !== undefined) setBudgetLzt(patch.budgetLzt);
    if (patch.sponsorHostPerMinute !== undefined) setSponsorHostPerMinute(patch.sponsorHostPerMinute);
    if (patch.sponsorPlayerPerMinute !== undefined) setSponsorPlayerPerMinute(patch.sponsorPlayerPerMinute);
    if (patch.gameId !== undefined) setGameId(patch.gameId);
    if (patch.minSessionMinutes !== undefined) setMinSessionMinutes(patch.minSessionMinutes);
    if (patch.maxSessionMinutes !== undefined) setMaxSessionMinutes(patch.maxSessionMinutes);
    if (patch.startAt !== undefined) setStartAt(patch.startAt);
    if (patch.endAt !== undefined) setEndAt(patch.endAt);
    if (patch.minGpuVram !== undefined) setMinGpuVram(patch.minGpuVram !== null ? String(patch.minGpuVram) : "");
    if (patch.minCpuCores !== undefined) setMinCpuCores(patch.minCpuCores !== null ? String(patch.minCpuCores) : "");
    if (patch.minRamGb !== undefined) setMinRamGb(patch.minRamGb !== null ? String(patch.minRamGb) : "");
    if (patch.minDownloadMbps !== undefined) setMinDownloadMbps(patch.minDownloadMbps !== null ? String(patch.minDownloadMbps) : "");
    if (patch.minUploadMbps !== undefined) setMinUploadMbps(patch.minUploadMbps !== null ? String(patch.minUploadMbps) : "");
    if (patch.recGpuVram !== undefined) setRecGpuVram(patch.recGpuVram !== null ? String(patch.recGpuVram) : "");
    if (patch.recCpuCores !== undefined) setRecCpuCores(patch.recCpuCores !== null ? String(patch.recCpuCores) : "");
    if (patch.recRamGb !== undefined) setRecRamGb(patch.recRamGb !== null ? String(patch.recRamGb) : "");
    if (patch.recDownloadMbps !== undefined) setRecDownloadMbps(patch.recDownloadMbps !== null ? String(patch.recDownloadMbps) : "");
    if (patch.recUploadMbps !== undefined) setRecUploadMbps(patch.recUploadMbps !== null ? String(patch.recUploadMbps) : "");
    if (patch.requiredTier && (patch.requiredTier === "min" || patch.requiredTier === "recommended")) setRequiredTier(patch.requiredTier);
  };

  const currentFormState = {
    kind,
    title,
    description,
    visibility,
    royaltyBasis,
    royaltyValue,
    royaltySource,
    budgetLzt,
    sponsorHostPerMinute,
    sponsorPlayerPerMinute,
    gameId,
    minSessionMinutes,
    maxSessionMinutes,
    startAt,
    endAt,
    minGpuVram,
    minCpuCores,
    minRamGb,
    minDownloadMbps,
    minUploadMbps,
    recGpuVram,
    recCpuCores,
    recRamGb,
    recDownloadMbps,
    recUploadMbps,
    requiredTier,
  };

  const isSponsor = kind === "sponsor";

  return (
    <div className="min-h-screen text-slate-300" style={{ background: "#06090e" }}>
      <SiteNav activePath="/quotas" />
      <main className="max-w-7xl mx-auto px-6 pt-10 pb-16">
        <div className="mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Новая квота
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Пресет-контракт, который ты сможешь прикрепить к любой сессии хоста.
          </p>
        </div>

        <div className="flex gap-6 items-start">
          <div className="flex-1 min-w-0">
            <form onSubmit={submit} className="space-y-6">
              <Card style={cardStyle}>
                <CardHeader>
                  <CardTitle className="text-white">Тип квоты</CardTitle>
                  <CardDescription className="text-slate-500">
                    Роялти забирает кусок с каждой минуты в пользу автора. Спонсор
                    заранее замораживает бюджет и доплачивает хосту/игроку.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RadioGroup
                    value={kind}
                    onValueChange={(v) => setKind(v as "royalty" | "sponsor")}
                    className="grid grid-cols-2 gap-4"
                  >
                    {[
                      { v: "royalty", label: "Роялти", Icon: Coins, color: "#fbbf24" },
                      { v: "sponsor", label: "Спонсор", Icon: Sparkles, color: "#38bdf8" },
                    ].map(({ v, label, Icon, color }) => (
                      <div key={v}>
                        <RadioGroupItem value={v} id={v} className="peer sr-only" />
                        <Label
                          htmlFor={v}
                          className="flex items-center gap-3 rounded-md p-4 cursor-pointer transition-all"
                          style={{
                            background:
                              kind === v
                                ? "rgba(14,165,233,0.1)"
                                : "rgba(255,255,255,0.02)",
                            border:
                              kind === v
                                ? "2px solid #0ea5e9"
                                : "2px solid rgba(255,255,255,0.06)",
                          }}
                        >
                          <Icon className="h-5 w-5" style={{ color }} />
                          <span className="text-white font-semibold">{label}</span>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </CardContent>
              </Card>

              <Card style={cardStyle}>
                <CardHeader>
                  <CardTitle className="text-white">Описание</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-slate-300">Название</Label>
                    <Input
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        setFieldErrors((prev) => clearQuotaFieldError(prev, "title"));
                      }}
                      placeholder="например, Мод-пак Skyrim Realism"
                      style={{
                        ...inputStyle,
                        borderColor: fieldErrors.title
                          ? "rgba(239,68,68,0.5)"
                          : inputStyle.border,
                      }}
                      className="mt-1"
                      data-testid="input-title"
                      aria-invalid={fieldErrors.title ? true : undefined}
                    />
                    {fieldErrors.title && (
                      <p className="text-xs text-red-400 mt-1" role="alert">
                        {fieldErrors.title}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label className="text-slate-300">Описание</Label>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Кратко расскажи, что входит в контракт"
                      style={inputStyle}
                      className="mt-1"
                      rows={3}
                      data-testid="input-description"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">Видимость</Label>
                    <RadioGroup
                      value={visibility}
                      onValueChange={(v) => setVisibility(v as "public" | "private")}
                      className="grid grid-cols-2 gap-3 mt-2"
                    >
                      {[
                        { v: "public", label: "Публичная" },
                        { v: "private", label: "По коду" },
                      ].map((opt) => (
                        <div key={opt.v}>
                          <RadioGroupItem
                            value={opt.v}
                            id={`vis-${opt.v}`}
                            className="peer sr-only"
                          />
                          <Label
                            htmlFor={`vis-${opt.v}`}
                            className="flex justify-center rounded-md py-2 text-sm cursor-pointer"
                            style={{
                              background:
                                visibility === opt.v
                                  ? "rgba(14,165,233,0.1)"
                                  : "rgba(255,255,255,0.02)",
                              border:
                                visibility === opt.v
                                  ? "2px solid #0ea5e9"
                                  : "2px solid rgba(255,255,255,0.06)",
                              color: visibility === opt.v ? "#fff" : "#94a3b8",
                            }}
                          >
                            {opt.label}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                  <div>
                    <Label className="text-slate-300">
                      Привязка к API-ключу (опционально)
                    </Label>
                    <Input
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Вставь dev-ключ, если квота только для него"
                      style={inputStyle}
                      className="mt-1"
                      data-testid="input-api-key"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Если указан ключ, квоту можно применить только к сессиям,
                      запущенным через этот API-ключ — она автоматически
                      применится к ним и станет недоступной для ручного выбора
                      другими хостами.
                    </p>
                  </div>
                  <div>
                    <Label className="text-slate-300">
                      Привязка к игре (опционально)
                    </Label>
                    <select
                      value={gameId}
                      onChange={(e) => setGameId(e.target.value)}
                      className="mt-1 w-full h-10 rounded-md px-3 text-sm"
                      style={inputStyle}
                      data-testid="select-game"
                    >
                      <option value="">Любая игра</option>
                      {(games ?? []).map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.title}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 mt-1">
                      Если выбрано, квоту можно прикрепить только к сессиям хоста,
                      привязанного к этой же игре.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-300">
                        Мин. длина сессии, мин
                      </Label>
                      <Input
                        type="number"
                        min={1}
                        value={minSessionMinutes}
                        onChange={(e) => {
                          setMinSessionMinutes(e.target.value);
                          setFieldErrors((prev) =>
                            clearQuotaFieldError(prev, "minSessionMinutes"),
                          );
                        }}
                        placeholder="без ограничения"
                        style={{
                          ...inputStyle,
                          borderColor: fieldErrors.minSessionMinutes
                            ? "rgba(239,68,68,0.5)"
                            : inputStyle.border,
                        }}
                        className="mt-1"
                        data-testid="input-min-session-min"
                        aria-invalid={fieldErrors.minSessionMinutes ? true : undefined}
                      />
                      {fieldErrors.minSessionMinutes && (
                        <p className="text-xs text-red-400 mt-1" role="alert">
                          {fieldErrors.minSessionMinutes}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label className="text-slate-300">
                        Макс. длина сессии, мин
                      </Label>
                      <Input
                        type="number"
                        min={1}
                        value={maxSessionMinutes}
                        onChange={(e) => {
                          setMaxSessionMinutes(e.target.value);
                          setFieldErrors((prev) =>
                            clearQuotaFieldError(prev, "maxSessionMinutes"),
                          );
                        }}
                        placeholder="без ограничения"
                        style={{
                          ...inputStyle,
                          borderColor: fieldErrors.maxSessionMinutes
                            ? "rgba(239,68,68,0.5)"
                            : inputStyle.border,
                        }}
                        className="mt-1"
                        data-testid="input-max-session-min"
                        aria-invalid={fieldErrors.maxSessionMinutes ? true : undefined}
                      />
                      {fieldErrors.maxSessionMinutes && (
                        <p className="text-xs text-red-400 mt-1" role="alert">
                          {fieldErrors.maxSessionMinutes}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-300">
                        Начало действия (опционально)
                      </Label>
                      <Input
                        type="datetime-local"
                        value={startAt}
                        onChange={(e) => {
                          setStartAt(e.target.value);
                          setFieldErrors((prev) => clearQuotaFieldError(prev, "startAt"));
                        }}
                        style={{
                          ...inputStyle,
                          borderColor: fieldErrors.startAt
                            ? "rgba(239,68,68,0.5)"
                            : inputStyle.border,
                        }}
                        className="mt-1"
                        data-testid="input-start-at"
                        aria-invalid={fieldErrors.startAt ? true : undefined}
                      />
                      {fieldErrors.startAt && (
                        <p className="text-xs text-red-400 mt-1" role="alert">
                          {fieldErrors.startAt}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label className="text-slate-300">
                        Конец действия (опционально)
                      </Label>
                      <Input
                        type="datetime-local"
                        value={endAt}
                        onChange={(e) => {
                          setEndAt(e.target.value);
                          setFieldErrors((prev) => clearQuotaFieldError(prev, "endAt"));
                        }}
                        style={{
                          ...inputStyle,
                          borderColor: fieldErrors.endAt
                            ? "rgba(239,68,68,0.5)"
                            : inputStyle.border,
                        }}
                        className="mt-1"
                        data-testid="input-end-at"
                        aria-invalid={fieldErrors.endAt ? true : undefined}
                      />
                      {fieldErrors.endAt && (
                        <p className="text-xs text-red-400 mt-1" role="alert">
                          {fieldErrors.endAt}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {kind === "royalty" ? (
                <Card style={cardStyle}>
                  <CardHeader>
                    <CardTitle className="text-white">Параметры роялти</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-slate-300">База расчёта</Label>
                      <RadioGroup
                        value={royaltyBasis}
                        onValueChange={(v) =>
                          setRoyaltyBasis(v as "percent" | "fixed_per_minute")
                        }
                        className="grid grid-cols-2 gap-3 mt-2"
                      >
                        {[
                          { v: "percent", label: "% от минуты" },
                          { v: "fixed_per_minute", label: "Фикс LZT/мин" },
                        ].map((opt) => (
                          <div key={opt.v}>
                            <RadioGroupItem
                              value={opt.v}
                              id={`rb-${opt.v}`}
                              className="peer sr-only"
                            />
                            <Label
                              htmlFor={`rb-${opt.v}`}
                              className="flex justify-center rounded-md py-2 text-sm cursor-pointer"
                              style={{
                                background:
                                  royaltyBasis === opt.v
                                    ? "rgba(251,191,36,0.12)"
                                    : "rgba(255,255,255,0.02)",
                                border:
                                  royaltyBasis === opt.v
                                    ? "2px solid #fbbf24"
                                    : "2px solid rgba(255,255,255,0.06)",
                                color: royaltyBasis === opt.v ? "#fff" : "#94a3b8",
                              }}
                            >
                              {opt.label}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                    <div>
                      <Label className="text-slate-300">
                        {royaltyBasis === "percent" ? "Процент (0–100)" : "LZT в минуту"}
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        max={royaltyBasis === "percent" ? 100 : 10000}
                        value={royaltyValue}
                        onChange={(e) => {
                          setRoyaltyValue(Number(e.target.value));
                          setFieldErrors((prev) =>
                            clearQuotaFieldError(prev, "royaltyValue"),
                          );
                        }}
                        style={{
                          ...inputStyle,
                          borderColor: fieldErrors.royaltyValue
                            ? "rgba(239,68,68,0.5)"
                            : inputStyle.border,
                        }}
                        className="mt-1"
                        data-testid="input-royalty-value"
                        aria-invalid={fieldErrors.royaltyValue ? true : undefined}
                      />
                      {fieldErrors.royaltyValue && (
                        <p className="text-xs text-red-400 mt-1" role="alert">
                          {fieldErrors.royaltyValue}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label className="text-slate-300">Откуда брать</Label>
                      <RadioGroup
                        value={royaltySource}
                        onValueChange={(v) =>
                          setRoyaltySource(v as "player" | "host_share")
                        }
                        className="grid grid-cols-2 gap-3 mt-2"
                      >
                        {[
                          { v: "host_share", label: "Из доли хоста" },
                          { v: "player", label: "Сверху с игрока" },
                        ].map((opt) => (
                          <div key={opt.v}>
                            <RadioGroupItem
                              value={opt.v}
                              id={`rs-${opt.v}`}
                              className="peer sr-only"
                            />
                            <Label
                              htmlFor={`rs-${opt.v}`}
                              className="flex justify-center rounded-md py-2 text-sm cursor-pointer"
                              style={{
                                background:
                                  royaltySource === opt.v
                                    ? "rgba(251,191,36,0.12)"
                                    : "rgba(255,255,255,0.02)",
                                border:
                                  royaltySource === opt.v
                                    ? "2px solid #fbbf24"
                                    : "2px solid rgba(255,255,255,0.06)",
                                color: royaltySource === opt.v ? "#fff" : "#94a3b8",
                              }}
                            >
                              {opt.label}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card style={cardStyle}>
                  <CardHeader>
                    <CardTitle className="text-white">Спонсорский эскроу</CardTitle>
                    <CardDescription className="text-slate-500">
                      Бюджет заморозится с твоего баланса «К выводу» при публикации.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-slate-300">Бюджет эскроу, LZT</Label>
                      <Input
                        type="number"
                        min={1}
                        value={budgetLzt}
                        onChange={(e) => {
                          setBudgetLzt(Number(e.target.value));
                          setFieldErrors((prev) => clearQuotaFieldError(prev, "budgetLzt"));
                        }}
                        style={{
                          ...inputStyle,
                          borderColor: fieldErrors.budgetLzt
                            ? "rgba(239,68,68,0.5)"
                            : inputStyle.border,
                        }}
                        className="mt-1"
                        data-testid="input-budget"
                        aria-invalid={fieldErrors.budgetLzt ? true : undefined}
                      />
                      {fieldErrors.budgetLzt && (
                        <p className="text-xs text-red-400 mt-1" role="alert">
                          {fieldErrors.budgetLzt}
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-slate-300">Хосту LZT/мин</Label>
                        <Input
                          type="number"
                          min={0}
                          value={sponsorHostPerMinute}
                          onChange={(e) => {
                            setSponsorHostPerMinute(Number(e.target.value));
                            setFieldErrors((prev) =>
                              clearQuotaFieldError(prev, "sponsorHostPerMinute"),
                            );
                          }}
                          style={{
                            ...inputStyle,
                            borderColor: fieldErrors.sponsorHostPerMinute
                              ? "rgba(239,68,68,0.5)"
                              : inputStyle.border,
                          }}
                          className="mt-1"
                          data-testid="input-host-per-min"
                          aria-invalid={fieldErrors.sponsorHostPerMinute ? true : undefined}
                        />
                        {fieldErrors.sponsorHostPerMinute && (
                          <p className="text-xs text-red-400 mt-1" role="alert">
                            {fieldErrors.sponsorHostPerMinute}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label className="text-slate-300">Игроку LZT/мин</Label>
                        <Input
                          type="number"
                          min={0}
                          value={sponsorPlayerPerMinute}
                          onChange={(e) => {
                            setSponsorPlayerPerMinute(Number(e.target.value));
                            setFieldErrors((prev) =>
                              clearQuotaFieldError(prev, "sponsorPlayerPerMinute"),
                            );
                          }}
                          style={{
                            ...inputStyle,
                            borderColor: fieldErrors.sponsorPlayerPerMinute
                              ? "rgba(239,68,68,0.5)"
                              : inputStyle.border,
                          }}
                          className="mt-1"
                          data-testid="input-player-per-min"
                          aria-invalid={fieldErrors.sponsorPlayerPerMinute ? true : undefined}
                        />
                        {fieldErrors.sponsorPlayerPerMinute && (
                          <p className="text-xs text-red-400 mt-1" role="alert">
                            {fieldErrors.sponsorPlayerPerMinute}
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">
                      При публикации с твоего баланса «К выводу» спишется{" "}
                      <span className="text-emerald-300 font-mono">
                        {budgetLzt.toLocaleString("ru-RU")} LZT
                      </span>
                      . Хватит примерно на{" "}
                      <span className="text-white font-mono">
                        {Math.floor(
                          budgetLzt /
                            Math.max(
                              1,
                              sponsorHostPerMinute + sponsorPlayerPerMinute,
                            ),
                        )}
                      </span>{" "}
                      минут.
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Minimal PC Power */}
              <Card style={cardStyle}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Cpu className="h-5 w-5 text-violet-400" />
                      <CardTitle className="text-white">Минимальная мощность ПК</CardTitle>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleAiSuggest}
                      disabled={aiLoading}
                      data-testid="button-ai-suggest"
                      style={{
                        background: "rgba(139,92,246,0.1)",
                        border: "1px solid rgba(139,92,246,0.4)",
                        color: "#a78bfa",
                      }}
                    >
                      {aiLoading ? (
                        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      ) : (
                        <Wand2 className="h-4 w-4 mr-1.5" />
                      )}
                      Подобрать через ИИ
                    </Button>
                  </div>
                  <CardDescription className="text-slate-500">
                    Если задано, квоту нельзя прикрепить к хосту, чей ПК слабее порога.
                    {gameId ? (
                      <span className="text-violet-400"> ИИ подберёт требования для выбранной игры.</span>
                    ) : (
                      <span className="text-slate-600"> Выбери игру выше, чтобы ИИ учёл её требования.</span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-300">VRAM GPU, ГБ</Label>
                      <Input
                        type="number"
                        min={1}
                        value={minGpuVram}
                        onChange={(e) => setMinGpuVram(e.target.value)}
                        placeholder="без ограничения"
                        style={inputStyle}
                        className="mt-1"
                        data-testid="input-min-gpu-vram"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300">Ядра CPU</Label>
                      <Input
                        type="number"
                        min={1}
                        value={minCpuCores}
                        onChange={(e) => setMinCpuCores(e.target.value)}
                        placeholder="без ограничения"
                        style={inputStyle}
                        className="mt-1"
                        data-testid="input-min-cpu-cores"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-300">RAM, ГБ</Label>
                      <Input
                        type="number"
                        min={1}
                        value={minRamGb}
                        onChange={(e) => setMinRamGb(e.target.value)}
                        placeholder="без ограничения"
                        style={inputStyle}
                        className="mt-1"
                        data-testid="input-min-ram-gb"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300">Скачивание, Мбит/с</Label>
                      <Input
                        type="number"
                        min={1}
                        value={minDownloadMbps}
                        onChange={(e) => setMinDownloadMbps(e.target.value)}
                        placeholder="без ограничения"
                        style={inputStyle}
                        className="mt-1"
                        data-testid="input-min-download-mbps"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-slate-300">
                      Мин. скорость аплоада, Мбит/с
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      value={minUploadMbps}
                      onChange={(e) => setMinUploadMbps(e.target.value)}
                      placeholder="без ограничения"
                      style={inputStyle}
                      className="mt-1"
                      data-testid="input-min-upload-mbps"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Рекомендуется ≥10 для 1080p стрима. Хосты ниже порога не попадут в матчинг.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Recommended PC Power + tier gate */}
              <Card style={cardStyle}>
                <CardHeader>
                  <CardTitle className="text-white">Рекомендуемая мощность ПК</CardTitle>
                  <CardDescription className="text-slate-500">
                    Более высокий порог для отметки «топовый хост». Хосты между минимумом и
                    рекомендуемым всё ещё подходят под квоту, если ниже не включён строгий режим.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-300">VRAM GPU, ГБ</Label>
                      <Input
                        type="number"
                        min={1}
                        value={recGpuVram}
                        onChange={(e) => setRecGpuVram(e.target.value)}
                        placeholder="без ограничения"
                        style={inputStyle}
                        className="mt-1"
                        data-testid="input-rec-gpu-vram"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300">Ядра CPU</Label>
                      <Input
                        type="number"
                        min={1}
                        value={recCpuCores}
                        onChange={(e) => setRecCpuCores(e.target.value)}
                        placeholder="без ограничения"
                        style={inputStyle}
                        className="mt-1"
                        data-testid="input-rec-cpu-cores"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-300">RAM, ГБ</Label>
                      <Input
                        type="number"
                        min={1}
                        value={recRamGb}
                        onChange={(e) => setRecRamGb(e.target.value)}
                        placeholder="без ограничения"
                        style={inputStyle}
                        className="mt-1"
                        data-testid="input-rec-ram-gb"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300">Скачивание, Мбит/с</Label>
                      <Input
                        type="number"
                        min={1}
                        value={recDownloadMbps}
                        onChange={(e) => setRecDownloadMbps(e.target.value)}
                        placeholder="без ограничения"
                        style={inputStyle}
                        className="mt-1"
                        data-testid="input-rec-download-mbps"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-slate-300">
                      Рек. скорость аплоада, Мбит/с
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      value={recUploadMbps}
                      onChange={(e) => setRecUploadMbps(e.target.value)}
                      placeholder="без ограничения"
                      style={inputStyle}
                      className="mt-1"
                      data-testid="input-rec-upload-mbps"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">Требуемый уровень хоста</Label>
                    <RadioGroup
                      value={requiredTier}
                      onValueChange={(v) => setRequiredTier(v as "min" | "recommended")}
                      className="grid grid-cols-2 gap-3 mt-2"
                    >
                      {[
                        { v: "min", label: "Достаточно минимума" },
                        { v: "recommended", label: "Только топовые хосты" },
                      ].map((opt) => (
                        <div key={opt.v}>
                          <RadioGroupItem
                            value={opt.v}
                            id={`tier-${opt.v}`}
                            className="peer sr-only"
                          />
                          <Label
                            htmlFor={`tier-${opt.v}`}
                            className="flex justify-center rounded-md py-2 text-sm cursor-pointer text-center"
                            style={{
                              background:
                                requiredTier === opt.v
                                  ? "rgba(139,92,246,0.12)"
                                  : "rgba(255,255,255,0.02)",
                              border:
                                requiredTier === opt.v
                                  ? "2px solid #8b5cf6"
                                  : "2px solid rgba(255,255,255,0.06)",
                              color: requiredTier === opt.v ? "#fff" : "#94a3b8",
                            }}
                            data-testid={`radio-required-tier-${opt.v}`}
                          >
                            {opt.label}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                    <p className="text-xs text-slate-500 mt-1">
                      «Только топовые хосты» — квоту получат только хосты, у которых
                      каждый параметр ПК превышает рекомендуемый порог.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* VirusTotal File Check */}
              <Card style={cardStyle}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-sm font-semibold flex items-center gap-2">
                    <span style={{ fontSize: 15 }}>🛡</span>
                    Антивирусная проверка файла
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Покажи хостерам, что игра безопасна — результат отображается в карточке квоты.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <VtScanner ownerToken={hostToken ?? ""} />
                </CardContent>
              </Card>

              {/* VDS Hosting section */}
              <Card style={cardStyle}>
                <CardHeader className="pb-2">
                  <button
                    type="button"
                    className="flex items-center gap-2 w-full text-left"
                    onClick={() => setVdsOpen((v) => !v)}
                    data-testid="vds-toggle"
                  >
                    {vdsOpen ? (
                      <ChevronDown className="w-4 h-4 text-sky-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                    <Server className="w-4 h-4 text-sky-400 shrink-0" />
                    <CardTitle className="text-white text-sm font-semibold">
                      Хостинг через VDS{" "}
                      <span
                        className="text-xs font-normal ml-1 px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(14,165,233,0.15)", color: "#38bdf8" }}
                      >
                        премиум
                      </span>
                    </CardTitle>
                  </button>
                  {!vdsOpen && (
                    <p className="text-xs text-slate-500 mt-1 ml-8">
                      Подключи свой VDS — платформа сама развернёт агент и будет хостить за тебя.
                    </p>
                  )}
                </CardHeader>

                {vdsOpen && (
                  <CardContent className="space-y-4 pt-0">
                    <div>
                      <Label className="text-slate-300">Провайдер</Label>
                      <select
                        className="mt-1 w-full h-10 rounded-md px-3 text-sm"
                        style={inputStyle}
                        value="ssh"
                        onChange={() => {}}
                      >
                        <option value="ssh">Свой SSH</option>
                      </select>
                      <p className="text-xs text-slate-500 mt-1">
                        Поддерживается Linux-сервер с Wine/Proton для запуска Windows-игр.
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <Label className="text-slate-300">SSH Host</Label>
                        <Input
                          value={vdsSshHost}
                          onChange={(e) => setVdsSshHost(e.target.value)}
                          placeholder="1.2.3.4 или example.com"
                          style={inputStyle}
                          className="mt-1"
                          data-testid="vds-ssh-host"
                        />
                      </div>
                      <div>
                        <Label className="text-slate-300">Порт</Label>
                        <Input
                          type="number"
                          min={1}
                          max={65535}
                          value={vdsSshPort}
                          onChange={(e) => setVdsSshPort(e.target.value)}
                          style={inputStyle}
                          className="mt-1"
                          data-testid="vds-ssh-port"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-slate-300">SSH User</Label>
                      <Input
                        value={vdsSshUser}
                        onChange={(e) => setVdsSshUser(e.target.value)}
                        placeholder="root"
                        style={inputStyle}
                        className="mt-1"
                        data-testid="vds-ssh-user"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300">
                        Приватный SSH-ключ (PEM / OpenSSH)
                      </Label>
                      <Textarea
                        value={vdsSshKey}
                        onChange={(e) => setVdsSshKey(e.target.value)}
                        placeholder={"-----BEGIN OPENSSH PRIVATE KEY-----\n..."}
                        style={{ ...inputStyle, fontFamily: "monospace", fontSize: "11px" }}
                        className="mt-1"
                        rows={5}
                        data-testid="vds-ssh-key"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Ключ шифруется и хранится зашифрованно на сервере. Публичная часть не сохраняется.
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={testVdsConnection}
                        disabled={vdsTesting}
                        style={{
                          borderColor: "rgba(255,255,255,0.12)",
                          color: "#94a3b8",
                          background: "transparent",
                        }}
                        data-testid="vds-test-connection"
                      >
                        {vdsTesting ? (
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        ) : null}
                        Проверить подключение
                      </Button>
                      {vdsTestResult !== null && (
                        <span
                          className="flex items-center gap-1 text-xs font-medium"
                          style={{ color: vdsTestResult.ok ? "#22c55e" : "#f87171" }}
                        >
                          {vdsTestResult.ok ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5" />
                          )}
                          {vdsTestResult.ok
                            ? "Подключение успешно"
                            : vdsTestResult.error ?? "Ошибка подключения"}
                        </span>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>

              <Card style={cardStyle}>
                <CardContent className="py-4 flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={publishNow}
                      onChange={(e) => setPublishNow(e.target.checked)}
                      data-testid="checkbox-publish-now"
                    />
                    Опубликовать сразу
                    {isSponsor && (
                      <span className="text-xs text-amber-400/80">
                        (заморозит {budgetLzt.toLocaleString("ru-RU")} LZT эскроу)
                      </span>
                    )}
                  </label>
                  <Button
                    type="submit"
                    size="lg"
                    disabled={createQuota.isPending || publishQuota.isPending}
                    className="font-bold"
                    style={{ background: "#0ea5e9", color: "#fff" }}
                    data-testid="button-create-quota"
                  >
                    {(createQuota.isPending || publishQuota.isPending) && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    Создать
                  </Button>
                </CardContent>
              </Card>
            </form>
          </div>

          <div className="w-96 shrink-0 sticky top-6">
            <QuotaAiChat
              ownerToken={hostToken ?? ""}
              currentFormState={currentFormState}
              availableGames={(games ?? []).map((g) => ({ id: g.id, title: g.title }))}
              onFormPatch={handleAiPatch}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
