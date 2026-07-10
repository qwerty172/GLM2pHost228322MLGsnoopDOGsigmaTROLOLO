import { useEffect, useMemo, useState } from "react";
import {
  useGetHost,
  useUpdateHostConfig,
  useListGames,
  getGetHostQueryKey,
} from "@workspace/api-client-react";
import type { ScheduleSlot } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Save, Trash2, Calendar, AlertTriangle } from "lucide-react";

const DAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60).toString().padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}
function hhmmToMinutes(s: string): number {
  const [h, m] = s.split(":").map((v) => Number(v));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return Math.max(0, Math.min(1440, h * 60 + m));
}

interface Props {
  hostToken: string;
}

export default function BindingForm({ hostToken }: Props) {
  const qc = useQueryClient();
  const { data: host, isLoading } = useGetHost(hostToken, {
    query: { enabled: !!hostToken, queryKey: getGetHostQueryKey(hostToken) },
  });
  const { data: games } = useListGames({});
  const update = useUpdateHostConfig();

  const [gameId, setGameId] = useState<string | null>(null);
  const [bindingKind, setBindingKind] = useState<"app" | "browser">("app");
  const [boundAppPath, setBoundAppPath] = useState("");
  const [boundUrl, setBoundUrl] = useState("");
  const [boundAppLabel, setBoundAppLabel] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [launchPriceUsd, setLaunchPriceUsd] = useState("0");
  const [minutePriceUsd, setMinutePriceUsd] = useState("0.04");
  const [scheduleMode, setScheduleMode] = useState<"always" | "scheduled">(
    "always",
  );
  const [scheduleJson, setScheduleJson] = useState<ScheduleSlot[]>([]);
  const [streamPlatform, setStreamPlatform] = useState("");
  const [streamUrl, setStreamUrl] = useState("");
  const [streamKey, setStreamKey] = useState("");
  const [clearStreamKey, setClearStreamKey] = useState(false);

  // Hydrate from server response, only on initial load.
  useEffect(() => {
    if (!host) return;
    setGameId(host.gameId);
    setBoundAppPath(host.boundAppPath ?? "");
    setBoundUrl(host.boundUrl ?? "");
    // Switch to "browser" mode when the saved offer has a URL but no .exe.
    setBindingKind(
      (host.boundUrl ?? "").length > 0 && (host.boundAppPath ?? "").length === 0
        ? "browser"
        : "app",
    );
    setBoundAppLabel(host.boundAppLabel ?? "");
    setDescription(host.description ?? "");
    setTags(host.tags ?? []);
    setLaunchPriceUsd(String(host.launchPriceUsd ?? 0));
    setMinutePriceUsd(String(host.minutePriceUsd ?? 0));
    setScheduleMode(host.scheduleMode === "scheduled" ? "scheduled" : "always");
    setScheduleJson(host.scheduleJson ?? []);
    setStreamPlatform(host.streamPlatform ?? "");
    setStreamUrl(host.streamUrl ?? "");
    // Stream key is never returned — leave the input empty so submitting
    // without typing into it preserves the existing key.
  }, [host?.id]);

  const gameOptions = useMemo(
    () =>
      (games ?? [])
        .slice()
        .sort((a, b) => a.title.localeCompare(b.title))
        .map((g) => ({ value: g.id, label: g.title })),
    [games],
  );

  function addSlot() {
    setScheduleJson((prev) => [
      ...prev,
      { day: 1, startMin: 18 * 60, endMin: 23 * 60 },
    ]);
  }
  function updateSlot(idx: number, patch: Partial<ScheduleSlot>) {
    setScheduleJson((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    );
  }
  function removeSlot(idx: number) {
    setScheduleJson((prev) => prev.filter((_, i) => i !== idx));
  }

  function onSave() {
    const lp = Number(launchPriceUsd);
    const mp = Number(minutePriceUsd);
    if (!Number.isFinite(lp) || Math.abs(lp) > 100) {
      toast.error("Цена запуска: число, |значение| ≤ 100");
      return;
    }
    if (!Number.isFinite(mp) || Math.abs(mp) > 100) {
      toast.error("Цена за минуту: число, |значение| ≤ 100");
      return;
    }
    if (scheduleMode === "scheduled") {
      for (const slot of scheduleJson) {
        if (slot.startMin === slot.endMin) {
          toast.error("Пустой слот расписания");
          return;
        }
        if (slot.startMin < 0 || slot.startMin > 1439 ||
            slot.endMin < 0 || slot.endMin > 1439) {
          toast.error("Время слота должно быть в диапазоне 00:00–23:59");
          return;
        }
      }
    }
    // Browser/app are mutually exclusive at runtime — clear the other field
    // when saving so the agent doesn't see stale data.
    const isBrowser = bindingKind === "browser";
    const sendAppPath = isBrowser ? "" : boundAppPath;
    const sendUrl = isBrowser ? boundUrl.trim() : "";
    if (isBrowser) {
      if (!sendUrl) {
        toast.error("Для браузерной игры нужен URL");
        return;
      }
      try {
        const u = new URL(sendUrl);
        if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("");
      } catch {
        toast.error("URL должен начинаться с http:// или https://");
        return;
      }
    }
    const defaultLabel = isBrowser
      ? (() => {
          try {
            return new URL(sendUrl).hostname;
          } catch {
            return "";
          }
        })()
      : sendAppPath.split(/[\\/]/).pop() || "";
    // Merge any text the host typed in the chip input but hasn't committed
    // (Enter / comma) so it isn't silently lost on save.
    const pendingTag = tagsInput.trim();
    const allTags = pendingTag ? [...tags, pendingTag] : tags;
    const body: Record<string, unknown> = {
      gameId,
      boundAppPath: sendAppPath,
      boundUrl: sendUrl,
      boundAppLabel: boundAppLabel || defaultLabel,
      description,
      tags: allTags,
      launchPriceUsd: lp,
      minutePriceUsd: mp,
      scheduleMode,
      scheduleJson,
      streamPlatform,
      streamUrl,
    };
    // Only send streamKey when the user typed something (an empty field
    // preserves the existing value). To explicitly remove the previously
    // saved key, the user toggles "Clear stream key" — we then send an empty
    // string, which the API treats as "wipe".
    if (clearStreamKey) {
      body.streamKey = "";
    } else if (streamKey.length > 0) {
      body.streamKey = streamKey;
    }

    update.mutate(
      { hostToken, data: body },
      {
        onSuccess: () => {
          toast.success("Настройки хоста сохранены");
          setStreamKey(""); // don't keep the secret in memory
          setClearStreamKey(false);
          setTagsInput("");
          qc.invalidateQueries({ queryKey: getGetHostQueryKey(hostToken) });
        },
        onError: (err) => {
          const msg = (err as Error)?.message ?? "Не удалось сохранить";
          toast.error(msg);
        },
      },
    );
  }

  return (
    <Card
      style={{
        background: "#0a1018",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
      data-testid="card-binding-form"
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Calendar className="h-5 w-5 text-sky-400" />
          Привязка игры и цены
        </CardTitle>
        <CardDescription className="text-slate-500">
          Привяжи хост к конкретной игре и укажи .exe или URL, который агент
          запустит при подключении игрока. Цены могут быть отрицательными
          (акции). Stream key — опционально, для рестрима окна игры.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="text-sm text-slate-500">Загрузка…</div>
        ) : (
          <>
            {host?.scheduleAutoDisabledReason && (
              <div
                className="flex items-start gap-2 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300"
                data-testid="banner-schedule-auto-disabled"
              >
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Расписание было отключено автоматически</p>
                  <p className="text-amber-300/80">{host.scheduleAutoDisabledReason}</p>
                </div>
              </div>
            )}
            {/* Game + executable */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="game" className="text-slate-300">Игра из каталога</Label>
                <Select
                  value={gameId ?? "__none__"}
                  onValueChange={(v) => setGameId(v === "__none__" ? null : v)}
                >
                  <SelectTrigger id="game" data-testid="select-game">
                    <SelectValue placeholder="Выбери игру" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Без привязки —</SelectItem>
                    {gameOptions.map((g) => (
                      <SelectItem key={g.value} value={g.value}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="appLabel" className="text-slate-300">Отображаемое имя</Label>
                <Input
                  id="appLabel"
                  data-testid="input-app-label"
                  value={boundAppLabel}
                  onChange={(e) => setBoundAppLabel(e.target.value)}
                  placeholder="например, Cyberpunk2077.exe"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="text-slate-300">Что запускает агент?</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={bindingKind === "app" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setBindingKind("app")}
                    data-testid="button-binding-kind-app"
                    style={
                      bindingKind === "app"
                        ? { background: "#0ea5e9", color: "#fff" }
                        : undefined
                    }
                  >
                    Нативный .exe
                  </Button>
                  <Button
                    type="button"
                    variant={bindingKind === "browser" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setBindingKind("browser")}
                    data-testid="button-binding-kind-browser"
                    style={
                      bindingKind === "browser"
                        ? { background: "#0ea5e9", color: "#fff" }
                        : undefined
                    }
                  >
                    Браузерная игра (URL)
                  </Button>
                </div>
              </div>
              {bindingKind === "app" ? (
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="appPath" className="text-slate-300">Путь к .exe на этом ПК</Label>
                  <Input
                    id="appPath"
                    data-testid="input-app-path"
                    value={boundAppPath}
                    onChange={(e) => setBoundAppPath(e.target.value)}
                    placeholder="C:/Games/Cyberpunk 2077/bin/x64/Cyberpunk2077.exe"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-slate-500">
                    Агент запустит этот файл, когда игрок подключится.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="boundUrl" className="text-slate-300">URL браузерной игры</Label>
                  <Input
                    id="boundUrl"
                    data-testid="input-bound-url"
                    type="url"
                    value={boundUrl}
                    onChange={(e) => setBoundUrl(e.target.value)}
                    placeholder="https://shellshock.io"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-slate-500">
                    Агент откроет этот URL в твоём браузере, когда игрок
                    подключится.
                  </p>
                </div>
              )}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="hostTags" className="text-slate-300">Теги возможностей</Label>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <Badge
                      key={t}
                      variant="secondary"
                      className="gap-1"
                      data-testid={`badge-tag-${t}`}
                    >
                      {t}
                      <button
                        type="button"
                        aria-label={`Remove tag ${t}`}
                        onClick={() =>
                          setTags((prev) => prev.filter((x) => x !== t))
                        }
                        className="ml-1 text-muted-foreground hover:text-foreground"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
                <Input
                  id="hostTags"
                  data-testid="input-tag"
                  value={tagsInput}
                  onChange={(e) => {
                    const v = e.target.value;
                    // Comma commits a tag — feels natural for chip inputs.
                    if (v.includes(",")) {
                      const parts = v.split(",").map((s) => s.trim()).filter(Boolean);
                      setTags((prev) => {
                        const seen = new Set(prev.map((p) => p.toLowerCase()));
                        const merged = [...prev];
                        for (const p of parts) {
                          if (seen.has(p.toLowerCase())) continue;
                          if (merged.length >= 20) break;
                          if (p.length > 40) continue;
                          seen.add(p.toLowerCase());
                          merged.push(p);
                        }
                        return merged;
                      });
                      setTagsInput("");
                    } else {
                      setTagsInput(v);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const v = tagsInput.trim();
                      if (!v) return;
                      if (v.length > 40 || tags.length >= 20) return;
                      if (tags.some((t) => t.toLowerCase() === v.toLowerCase())) {
                        setTagsInput("");
                        return;
                      }
                      setTags((prev) => [...prev, v]);
                      setTagsInput("");
                    } else if (
                      e.key === "Backspace" &&
                      tagsInput === "" &&
                      tags.length > 0
                    ) {
                      setTags((prev) => prev.slice(0, -1));
                    }
                  }}
                  placeholder="Введи и нажми Enter (например, прокачанный аккаунт, лицензия Adobe)"
                />
                <p className="text-xs text-slate-500">
                  До 20 тегов, ≤40 символов в каждом. Игроки фильтруют каталог по тегам.
                </p>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="desc" className="text-slate-300">Описание</Label>
                <Textarea
                  id="desc"
                  data-testid="input-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Железо, моды, правила, атмосфера…"
                  maxLength={4000}
                />
              </div>
            </div>

            {/* Pricing */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="launchPrice" className="text-slate-300">
                  Цена запуска (USD, можно отрицательную)
                </Label>
                <Input
                  id="launchPrice"
                  data-testid="input-launch-price"
                  type="number"
                  step="0.01"
                  value={launchPriceUsd}
                  onChange={(e) => setLaunchPriceUsd(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minutePrice" className="text-slate-300">
                  Цена за минуту (USD, можно отрицательную)
                </Label>
                <Input
                  id="minutePrice"
                  data-testid="input-minute-price"
                  type="number"
                  step="0.01"
                  value={minutePriceUsd}
                  onChange={(e) => setMinutePriceUsd(e.target.value)}
                />
              </div>
            </div>

            {/* Schedule */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="schedMode" className="text-slate-300">Расписание доступности</Label>
                <Badge variant={scheduleMode === "always" ? "default" : "secondary"}>
                  {scheduleMode === "always" ? "всегда" : "по расписанию"}
                </Badge>
              </div>
              <Select
                value={scheduleMode}
                onValueChange={(v) =>
                  setScheduleMode(v === "scheduled" ? "scheduled" : "always")
                }
              >
                <SelectTrigger id="schedMode" data-testid="select-schedule-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="always">
                    Всегда доступен, пока агент запущен
                  </SelectItem>
                  <SelectItem value="scheduled">
                    Только в указанных ниже слотах
                  </SelectItem>
                </SelectContent>
              </Select>
              {scheduleMode === "scheduled" && (
                <div className="space-y-2 rounded border border-white/10 p-3 bg-white/[0.02]">
                  {scheduleJson.length === 0 && (
                    <p className="text-xs text-slate-500">
                      Слотов нет — хост будет оффлайн. Добавь хотя бы один.
                    </p>
                  )}
                  {scheduleJson.map((slot, i) => (
                    <div
                      key={i}
                      className="flex flex-wrap items-end gap-2"
                      data-testid={`schedule-slot-${i}`}
                    >
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-400">День (UTC)</Label>
                        <Select
                          value={String(slot.day)}
                          onValueChange={(v) =>
                            updateSlot(i, { day: Number(v) })
                          }
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DAYS.map((d, idx) => (
                              <SelectItem key={d} value={String(idx)}>
                                {d}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-400">С</Label>
                        <Input
                          type="time"
                          value={minutesToHHMM(slot.startMin)}
                          onChange={(e) =>
                            updateSlot(i, {
                              startMin: hhmmToMinutes(e.target.value),
                            })
                          }
                          className="w-28"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-400">До</Label>
                        <Input
                          type="time"
                          value={minutesToHHMM(slot.endMin)}
                          onChange={(e) =>
                            updateSlot(i, {
                              endMin: hhmmToMinutes(e.target.value),
                            })
                          }
                          className="w-28"
                        />
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeSlot(i)}
                        data-testid={`button-remove-slot-${i}`}
                        aria-label="Удалить слот"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addSlot}
                    data-testid="button-add-slot"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Добавить слот
                  </Button>
                </div>
              )}
            </div>

            {/* Restream */}
            <div className="space-y-3">
              <Label className="text-base text-slate-300">
                Рестрим (опционально)
                {host?.streamKeySet && (
                  <Badge variant="outline" className="ml-2">
                    ключ задан
                  </Badge>
                )}
              </Label>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="sp" className="text-xs text-slate-400">
                    Платформа
                  </Label>
                  <Input
                    id="sp"
                    data-testid="input-stream-platform"
                    value={streamPlatform}
                    onChange={(e) => setStreamPlatform(e.target.value)}
                    placeholder="twitch / youtube / rtmp"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="su" className="text-xs text-slate-400">
                    Ingest URL
                  </Label>
                  <Input
                    id="su"
                    data-testid="input-stream-url"
                    value={streamUrl}
                    onChange={(e) => setStreamUrl(e.target.value)}
                    placeholder="rtmp://live.twitch.tv/app"
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-1 md:col-span-3">
                  <Label htmlFor="sk" className="text-xs text-slate-400">
                    Stream key (оставь пустым, чтобы сохранить текущий)
                  </Label>
                  <Input
                    id="sk"
                    data-testid="input-stream-key"
                    type="password"
                    value={streamKey}
                    onChange={(e) => {
                      setStreamKey(e.target.value);
                      if (e.target.value.length > 0) setClearStreamKey(false);
                    }}
                    placeholder="••••••••"
                    disabled={clearStreamKey}
                  />
                  {host?.streamKeySet && (
                    <label className="flex items-center gap-2 text-xs text-slate-500">
                      <input
                        type="checkbox"
                        data-testid="checkbox-clear-stream-key"
                        checked={clearStreamKey}
                        onChange={(e) => {
                          setClearStreamKey(e.target.checked);
                          if (e.target.checked) setStreamKey("");
                        }}
                      />
                      Очистить сохранённый stream key при следующем сохранении
                    </label>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={onSave}
                disabled={update.isPending}
                data-testid="button-save-binding"
                style={{ background: "#0ea5e9", color: "#fff" }}
              >
                <Save className="h-4 w-4 mr-2" />
                {update.isPending ? "Сохраняем…" : "Сохранить"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
