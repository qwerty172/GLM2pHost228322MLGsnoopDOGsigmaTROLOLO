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
import { Coins, Sparkles, Loader2 } from "lucide-react";

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

  const createQuota = useCreateQuota();
  const publishQuota = usePublishQuota();
  const { data: games } = useListGames({});

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostToken) {
      toast.error("Нужно войти как хост");
      return;
    }
    if (!title.trim()) {
      toast.error("Укажи название");
      return;
    }
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
        },
      });
      toast.success("Черновик создан");
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

  const isSponsor = kind === "sponsor";

  return (
    <div className="min-h-screen text-slate-300" style={{ background: "#06090e" }}>
      <SiteNav activePath="/quotas" />
      <main className="max-w-2xl mx-auto px-6 pt-10 pb-16 space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Новая квота
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Пресет-контракт, который ты сможешь прикрепить к любой сессии хоста.
          </p>
        </div>

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
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="например, Мод-пак Skyrim Realism"
                  style={inputStyle}
                  className="mt-1"
                  data-testid="input-title"
                />
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
                    onChange={(e) => setMinSessionMinutes(e.target.value)}
                    placeholder="без ограничения"
                    style={inputStyle}
                    className="mt-1"
                    data-testid="input-min-session-min"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">
                    Макс. длина сессии, мин
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    value={maxSessionMinutes}
                    onChange={(e) => setMaxSessionMinutes(e.target.value)}
                    placeholder="без ограничения"
                    style={inputStyle}
                    className="mt-1"
                    data-testid="input-max-session-min"
                  />
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
                    onChange={(e) => setStartAt(e.target.value)}
                    style={inputStyle}
                    className="mt-1"
                    data-testid="input-start-at"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">
                    Конец действия (опционально)
                  </Label>
                  <Input
                    type="datetime-local"
                    value={endAt}
                    onChange={(e) => setEndAt(e.target.value)}
                    style={inputStyle}
                    className="mt-1"
                    data-testid="input-end-at"
                  />
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
                    onChange={(e) => setRoyaltyValue(Number(e.target.value))}
                    style={inputStyle}
                    className="mt-1"
                    data-testid="input-royalty-value"
                  />
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
                  Бюджет заморозится с твоего зелёного баланса при публикации.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-slate-300">Бюджет эскроу, LZT</Label>
                  <Input
                    type="number"
                    min={1}
                    value={budgetLzt}
                    onChange={(e) => setBudgetLzt(Number(e.target.value))}
                    style={inputStyle}
                    className="mt-1"
                    data-testid="input-budget"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300">Хосту LZT/мин</Label>
                    <Input
                      type="number"
                      min={0}
                      value={sponsorHostPerMinute}
                      onChange={(e) =>
                        setSponsorHostPerMinute(Number(e.target.value))
                      }
                      style={inputStyle}
                      className="mt-1"
                      data-testid="input-host-per-min"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">Игроку LZT/мин</Label>
                    <Input
                      type="number"
                      min={0}
                      value={sponsorPlayerPerMinute}
                      onChange={(e) =>
                        setSponsorPlayerPerMinute(Number(e.target.value))
                      }
                      style={inputStyle}
                      className="mt-1"
                      data-testid="input-player-per-min"
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  При публикации с твоего зелёного баланса спишется{" "}
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
      </main>
    </div>
  );
}
