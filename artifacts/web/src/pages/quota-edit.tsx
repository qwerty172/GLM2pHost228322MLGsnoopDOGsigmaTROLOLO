import { useEffect, useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { toast } from "sonner";
import {
  useGetQuota,
  useUpdateQuota,
  useListGames,
} from "@workspace/api-client-react";
import { SiteNav } from "@/components/site-nav";
import { useAuth } from "@/hooks/use-auth";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2 } from "lucide-react";
import { QuotaAiChat, type QuotaFormPatch } from "@/components/quota-ai-chat";

const cardStyle = {
  background: "#0a1018",
  border: "1px solid rgba(255,255,255,0.06)",
} as const;
const inputStyle = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#e2e8f0",
};

export default function QuotaEditPage() {
  const { id } = useParams<{ id: string }>();
  const { hostToken } = useAuth();
  const [, navigate] = useLocation();
  const params = hostToken ? { ownerToken: hostToken } : {};
  const { data: quota, isLoading } = useGetQuota(id!, params);
  const update = useUpdateQuota();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budgetLzt, setBudgetLzt] = useState<number>(0);
  const [sponsorHostPerMinute, setSponsorHostPerMinute] = useState<number>(0);
  const [sponsorPlayerPerMinute, setSponsorPlayerPerMinute] = useState<number>(0);
  const [royaltyValue, setRoyaltyValue] = useState<number>(0);
  const [gameId, setGameId] = useState<string>("");
  const [minSessionMinutes, setMinSessionMinutes] = useState<string>("");
  const [maxSessionMinutes, setMaxSessionMinutes] = useState<string>("");
  const [endAt, setEndAt] = useState<string>("");
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

  const { data: games } = useListGames({});

  useEffect(() => {
    if (!quota) return;
    setTitle(quota.title);
    setDescription(quota.description);
    setBudgetLzt(quota.budgetLzt ?? 0);
    setSponsorHostPerMinute(quota.sponsorHostPerMinuteLzt ?? 0);
    setSponsorPlayerPerMinute(quota.sponsorPlayerPerMinuteLzt ?? 0);
    setRoyaltyValue(quota.royaltyValue ?? 0);
    setGameId(quota.gameId ?? "");
    setMinSessionMinutes(
      quota.minSessionMinutes != null ? String(quota.minSessionMinutes) : "",
    );
    setMaxSessionMinutes(
      quota.maxSessionMinutes != null ? String(quota.maxSessionMinutes) : "",
    );
    setEndAt(quota.endAt ? quota.endAt.slice(0, 16) : "");
    setMinGpuVram(quota.minGpuVram != null ? String(quota.minGpuVram) : "");
    setMinCpuCores(quota.minCpuCores != null ? String(quota.minCpuCores) : "");
    setMinRamGb(quota.minRamGb != null ? String(quota.minRamGb) : "");
    setMinDownloadMbps(quota.minDownloadMbps != null ? String(quota.minDownloadMbps) : "");
    setMinUploadMbps(quota.minUploadMbps != null ? String(quota.minUploadMbps) : "");
    setRecGpuVram(quota.recGpuVram != null ? String(quota.recGpuVram) : "");
    setRecCpuCores(quota.recCpuCores != null ? String(quota.recCpuCores) : "");
    setRecRamGb(quota.recRamGb != null ? String(quota.recRamGb) : "");
    setRecDownloadMbps(quota.recDownloadMbps != null ? String(quota.recDownloadMbps) : "");
    setRecUploadMbps(quota.recUploadMbps != null ? String(quota.recUploadMbps) : "");
    setRequiredTier(quota.requiredTier === "recommended" ? "recommended" : "min");
  }, [quota]);

  if (isLoading || !quota) {
    return (
      <div className="min-h-screen" style={{ background: "#06090e" }}>
        <SiteNav activePath="/quotas" />
        <main className="max-w-2xl mx-auto px-6 pt-10 text-slate-500">
          Загрузка…
        </main>
      </div>
    );
  }
  if (!hostToken || quota.isOwner !== true) {
    return (
      <div className="min-h-screen" style={{ background: "#06090e" }}>
        <SiteNav activePath="/quotas" />
        <main className="max-w-2xl mx-auto px-6 pt-10 text-slate-500">
          Только автор может редактировать.
        </main>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostToken) return;
    try {
      await update.mutateAsync({
        id: quota.id,
        data: {
          ownerToken: hostToken,
          title,
          description,
          gameId: gameId || null,
          minSessionMinutes: minSessionMinutes
            ? Math.max(1, Math.floor(Number(minSessionMinutes)))
            : null,
          maxSessionMinutes: maxSessionMinutes
            ? Math.max(1, Math.floor(Number(maxSessionMinutes)))
            : null,
          endAt: endAt ? new Date(endAt).toISOString() : null,
          budgetLzt: quota.kind === "sponsor" ? Math.floor(budgetLzt) : null,
          sponsorHostPerMinuteLzt:
            quota.kind === "sponsor" ? Math.floor(sponsorHostPerMinute) : null,
          sponsorPlayerPerMinuteLzt:
            quota.kind === "sponsor"
              ? Math.floor(sponsorPlayerPerMinute)
              : null,
          royaltyValue:
            quota.kind === "royalty" ? Math.floor(royaltyValue) : null,
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
        },
      });
      toast.success("Изменения сохранены");
      navigate(`/quotas/${quota.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    }
  };

  const handleAiPatch = (patch: QuotaFormPatch) => {
    if (patch.title !== undefined) setTitle(patch.title);
    if (patch.description !== undefined) setDescription(patch.description);
    if (patch.budgetLzt !== undefined) setBudgetLzt(patch.budgetLzt);
    if (patch.sponsorHostPerMinute !== undefined) setSponsorHostPerMinute(patch.sponsorHostPerMinute);
    if (patch.sponsorPlayerPerMinute !== undefined) setSponsorPlayerPerMinute(patch.sponsorPlayerPerMinute);
    if (patch.royaltyValue !== undefined) setRoyaltyValue(patch.royaltyValue);
    if (patch.gameId !== undefined) setGameId(patch.gameId);
    if (patch.minSessionMinutes !== undefined) setMinSessionMinutes(patch.minSessionMinutes);
    if (patch.maxSessionMinutes !== undefined) setMaxSessionMinutes(patch.maxSessionMinutes);
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
    kind: quota.kind,
    title,
    description,
    visibility: quota.visibility,
    royaltyBasis: quota.royaltyBasis ?? "",
    royaltyValue,
    royaltySource: quota.royaltySource ?? "",
    budgetLzt,
    sponsorHostPerMinute,
    sponsorPlayerPerMinute,
    gameId,
    minSessionMinutes,
    maxSessionMinutes,
    startAt: "",
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

  return (
    <div className="min-h-screen text-slate-300" style={{ background: "#06090e" }}>
      <SiteNav activePath="/quotas" />
      <main className="max-w-7xl mx-auto px-6 pt-10 pb-16">
        <Link href={`/quotas/${quota.id}`}>
          <span className="text-xs text-slate-500 hover:text-sky-400 cursor-pointer">
            ← К квоте
          </span>
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight text-white mt-3 mb-6">
          Редактировать квоту
        </h1>
        {quota.status !== "draft" && (
          <p className="text-xs text-amber-400/80 mb-4">
            Квота уже опубликована — большинство полей будет редактируемо только
            пока нет ни одного движения.
          </p>
        )}

        <div className="flex gap-6 items-start">
          <div className="flex-1 min-w-0">
            <form onSubmit={submit} className="space-y-6">
              <Card style={cardStyle}>
                <CardHeader>
                  <CardTitle className="text-white">Основное</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-slate-300">Название</Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      style={inputStyle}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">Описание</Label>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      style={inputStyle}
                      className="mt-1"
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">Привязка к игре</Label>
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
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-300">Мин. минут</Label>
                      <Input
                        type="number"
                        min={1}
                        value={minSessionMinutes}
                        onChange={(e) => setMinSessionMinutes(e.target.value)}
                        placeholder="без ограничения"
                        style={inputStyle}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300">Макс. минут</Label>
                      <Input
                        type="number"
                        min={1}
                        value={maxSessionMinutes}
                        onChange={(e) => setMaxSessionMinutes(e.target.value)}
                        placeholder="без ограничения"
                        style={inputStyle}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-slate-300">Конец действия</Label>
                    <Input
                      type="datetime-local"
                      value={endAt}
                      onChange={(e) => setEndAt(e.target.value)}
                      style={inputStyle}
                      className="mt-1"
                    />
                  </div>
                  {quota.kind === "royalty" ? (
                    <div>
                      <Label className="text-slate-300">
                        {quota.royaltyBasis === "percent"
                          ? "Процент"
                          : "LZT в минуту"}
                      </Label>
                      <Input
                        type="number"
                        value={royaltyValue}
                        onChange={(e) => setRoyaltyValue(Number(e.target.value))}
                        style={inputStyle}
                        className="mt-1"
                      />
                    </div>
                  ) : (
                    <>
                      <div>
                        <Label className="text-slate-300">Бюджет, LZT</Label>
                        <Input
                          type="number"
                          value={budgetLzt}
                          onChange={(e) => setBudgetLzt(Number(e.target.value))}
                          style={inputStyle}
                          className="mt-1"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-slate-300">Хосту LZT/мин</Label>
                          <Input
                            type="number"
                            value={sponsorHostPerMinute}
                            onChange={(e) =>
                              setSponsorHostPerMinute(Number(e.target.value))
                            }
                            style={inputStyle}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-slate-300">Игроку LZT/мин</Label>
                          <Input
                            type="number"
                            value={sponsorPlayerPerMinute}
                            onChange={(e) =>
                              setSponsorPlayerPerMinute(Number(e.target.value))
                            }
                            style={inputStyle}
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
              <Card style={cardStyle}>
                <CardHeader>
                  <CardTitle className="text-white">Требования к ПК хоста</CardTitle>
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
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-slate-300">Мин. скорость аплоада, Мбит/с</Label>
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
                      Рекомендуется ≥10 для 1080p стрима.
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card style={cardStyle}>
                <CardHeader>
                  <CardTitle className="text-white">Рекомендуемая мощность ПК</CardTitle>
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
                    <Label className="text-slate-300">Рек. скорость аплоада, Мбит/с</Label>
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
                            id={`edit-tier-${opt.v}`}
                            className="peer sr-only"
                          />
                          <Label
                            htmlFor={`edit-tier-${opt.v}`}
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
                  </div>
                </CardContent>
              </Card>
              <Button
                type="submit"
                disabled={update.isPending}
                className="font-bold"
                style={{ background: "#0ea5e9", color: "#fff" }}
                data-testid="button-save-quota"
              >
                {update.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Сохранить
              </Button>
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
