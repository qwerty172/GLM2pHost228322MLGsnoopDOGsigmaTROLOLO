import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  useCreateSession,
  useListApplicableQuotas,
  useListGames,
  getListApplicableQuotasQueryKey,
  getListGamesQueryKey,
  type Quota,
} from "@workspace/api-client-react";
import { Coins, Sparkles } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import {
  Gamepad2,
  Monitor,
  Zap,
  Loader2,
  Copy,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  buildApplicableQuotasParams,
  buildCreateSessionBody,
  buildShareLink,
  canCreateSession,
  formatQuotaRateLabel,
  isSubmitDisabled,
  normalizeQuotaAccessCode,
  resolvePresetGames,
} from "./setup-helpers";

const cardStyle = {
  background: "#0a1018",
  border: "1px solid rgba(255,255,255,0.06)",
};

export default function SetupSession() {
  const { hostToken } = useAuth();
  const [appName, setAppName] = useState("");
  const [resolution, setResolution] = useState("1080p");
  const [bitrateKbps, setBitrateKbps] = useState<number[]>([8000]);
  const [createdSession, setCreatedSession] = useState<{
    appName: string;
    playerToken: string;
    inviteCode?: string | null;
  } | null>(null);
  const [selectedQuotaId, setSelectedQuotaId] = useState<string | null>(null);
  const [accessCode, setAccessCode] = useState<string>("");

  const { data: catalogGames } = useListGames(
    {},
    { query: { queryKey: getListGamesQueryKey({}), staleTime: 60_000 } },
  );
  const presetGames = resolvePresetGames(catalogGames);

  const createSession = useCreateSession();
  const applicableParams = buildApplicableQuotasParams(hostToken, accessCode);
  const { data: applicableQuotas } = useListApplicableQuotas(
    applicableParams,
    {
      query: {
        enabled: !!hostToken,
        queryKey: getListApplicableQuotasQueryKey(applicableParams),
      },
    },
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateSession(hostToken, appName)) return;

    createSession.mutate(
      {
        data: buildCreateSessionBody({
          hostToken: hostToken!,
          appName,
          resolution,
          bitrateKbps: bitrateKbps[0],
          selectedQuotaId,
          accessCode,
        }),
      },
      {
        onSuccess: (session) => {
          setCreatedSession({
            appName: session.appName,
            playerToken: session.playerToken,
            inviteCode: session.inviteCode,
          });
        },
        onError: () => {
          toast.error("Не удалось создать сессию");
        },
      },
    );
  };

  if (createdSession) {
    const shareLink = buildShareLink({
      origin: window.location.origin,
      baseUrl: import.meta.env.BASE_URL,
      playerToken: createdSession.playerToken,
      inviteCode: createdSession.inviteCode,
    });
    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(shareLink);
        toast.success("Ссылка скопирована");
      } catch {
        toast.error("Не удалось скопировать ссылку");
      }
    };
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card style={cardStyle}>
          <CardHeader className="text-center pb-4">
            <CheckCircle2 className="h-12 w-12 text-teal-400 mx-auto mb-3" />
            <CardTitle className="text-2xl text-white">Сессия готова</CardTitle>
            <CardDescription className="text-slate-500">
              Стрим для{" "}
              <span className="text-white font-semibold">
                {createdSession.appName}
              </span>{" "}
              поставлен в очередь. Отправь игроку ссылку, чтобы начать стрим.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-slate-500 uppercase tracking-wider">
                Ссылка для игрока
              </Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={shareLink}
                  className="font-mono text-sm"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#e2e8f0",
                  }}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button
                  type="button"
                  onClick={handleCopy}
                  className="gap-2 h-9"
                  style={{ background: "#0ea5e9", color: "#fff" }}
                >
                  <Copy className="h-4 w-4" />
                  Копировать
                </Button>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between py-4 border-t border-white/5">
            <Button
              type="button"
              variant="outline"
              className="border-white/10 text-slate-300 hover:text-white"
              onClick={() => {
                setCreatedSession(null);
                setAppName("");
              }}
            >
              Создать ещё
            </Button>
            <Link href="/host">
              <Button
                className="gap-2 font-bold"
                style={{ background: "#0ea5e9", color: "#fff" }}
              >
                В дашборд
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div
        className="rounded-lg px-4 py-3 text-sm"
        style={{
          background: "rgba(14,165,233,0.08)",
          border: "1px solid rgba(14,165,233,0.25)",
          color: "#94a3b8",
        }}
      >
        Расширенная настройка сессии — для опытных хостов. Быстрый старт:{" "}
        <Link href="/host" className="text-sky-400 underline-offset-2 hover:underline">
          дашборд
        </Link>
        .
      </div>
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">
          Новая сессия
        </h1>
        <p className="text-sm text-slate-500">
          Настрой игру, которую будешь стримить с этого ПК.
        </p>
      </div>

      <form onSubmit={handleCreate}>
        <Card style={cardStyle}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Gamepad2 className="h-5 w-5 text-sky-400" />
              Выбор игры
            </CardTitle>
            <CardDescription className="text-slate-500">
              Какую игру будешь хостить?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="appName" className="text-slate-300">
                Название игры
              </Label>
              <Input
                id="appName"
                placeholder="например, Grand Theft Auto V"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#e2e8f0",
                }}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-slate-500 uppercase tracking-wider">
                Быстрые пресеты
              </Label>
              <div className="flex flex-wrap gap-2">
                {presetGames.map((game) => (
                  <button
                    key={game}
                    type="button"
                    className="h-7 px-3 rounded-full text-xs transition-colors"
                    style={{
                      background:
                        appName === game
                          ? "rgba(14,165,233,0.15)"
                          : "rgba(255,255,255,0.03)",
                      color: appName === game ? "#38bdf8" : "#94a3b8",
                      border:
                        appName === game
                          ? "1px solid rgba(14,165,233,0.3)"
                          : "1px solid rgba(255,255,255,0.08)",
                    }}
                    onClick={() => setAppName(game)}
                  >
                    {game}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6" style={cardStyle}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Coins className="h-5 w-5 text-amber-400" />
              Квота (опционально)
            </CardTitle>
            <CardDescription className="text-slate-500">
              Прикрепи пресет-контракт: роялти автору или спонсорский эскроу.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <QuotaPicker
              quotas={applicableQuotas ?? []}
              selectedId={selectedQuotaId}
              onSelect={setSelectedQuotaId}
            />
            <div className="space-y-1">
              <Label className="text-xs text-slate-500 uppercase tracking-wider">
                Приватный код квоты
              </Label>
              <Input
                placeholder="например, A3F9KMP2"
                value={accessCode}
                onChange={(e) => setAccessCode(normalizeQuotaAccessCode(e.target.value))}
                className="font-mono"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#e2e8f0",
                }}
                data-testid="input-quota-code"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6" style={cardStyle}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Monitor className="h-5 w-5 text-sky-400" />
              Качество стрима
            </CardTitle>
            <CardDescription className="text-slate-500">
              Параметры видео-кодирования.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="space-y-3">
              <Label className="text-slate-300">Разрешение</Label>
              <RadioGroup
                value={resolution}
                onValueChange={setResolution}
                className="grid grid-cols-3 gap-4"
              >
                {[
                  { id: "720p", label: "720p", desc: "60 FPS · стандарт" },
                  { id: "1080p", label: "1080p", desc: "60 FPS · высокое" },
                  { id: "1440p", label: "1440p", desc: "60 FPS · ультра" },
                ].map((res) => (
                  <div key={res.id}>
                    <RadioGroupItem
                      value={res.id}
                      id={res.id}
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor={res.id}
                      className="flex flex-col items-center justify-between rounded-md p-4 cursor-pointer transition-all"
                      style={{
                        background:
                          resolution === res.id
                            ? "rgba(14,165,233,0.1)"
                            : "rgba(255,255,255,0.02)",
                        border:
                          resolution === res.id
                            ? "2px solid #0ea5e9"
                            : "2px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <span className="text-xl font-bold font-mono text-white">
                        {res.label}
                      </span>
                      <span className="text-[11px] text-slate-500 mt-1">
                        {res.desc}
                      </span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-slate-300">Битрейт видео</Label>
                <span className="font-mono font-bold text-sky-400">
                  {bitrateKbps[0]} kbps
                </span>
              </div>
              <Slider
                value={bitrateKbps}
                onValueChange={setBitrateKbps}
                max={15000}
                min={3000}
                step={500}
                className="py-4"
              />
              <div className="flex justify-between text-xs text-slate-500 font-mono">
                <span>3000 (низкий)</span>
                <span>15000 (макс.)</span>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end py-4 border-t border-white/5">
            <Button
              type="submit"
              size="lg"
              disabled={isSubmitDisabled(createSession.isPending, appName)}
              className="font-bold"
              style={{ background: "#0ea5e9", color: "#fff" }}
            >
              {createSession.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Zap className="mr-2 h-4 w-4" />
              )}
              Запустить стрим
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}

function QuotaPicker({
  quotas,
  selectedId,
  onSelect,
}: {
  quotas: Quota[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  if (quotas.length === 0) {
    return (
      <p className="text-xs text-slate-500">
        Подходящих квот пока нет. Создай свою на странице{" "}
        <Link href="/quotas/new">
          <span className="text-sky-400 underline cursor-pointer">
            «Новая квота»
          </span>
        </Link>{" "}
        или введи код приватной квоты.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className="text-left p-3 rounded-md transition-colors"
        style={{
          background: selectedId === null ? "rgba(14,165,233,0.15)" : "rgba(255,255,255,0.02)",
          border:
            selectedId === null
              ? "1px solid #0ea5e9"
              : "1px solid rgba(255,255,255,0.06)",
        }}
        data-testid="quota-picker-none"
      >
        <div className="text-sm font-semibold text-white">Без квоты</div>
        <div className="text-[11px] text-slate-500">
          Стандартный сплит хост/игрок.
        </div>
      </button>
      {quotas.map((q) => (
        <button
          key={q.id}
          type="button"
          onClick={() => onSelect(q.id)}
          className="text-left p-3 rounded-md transition-colors"
          style={{
            background:
              selectedId === q.id
                ? "rgba(14,165,233,0.15)"
                : "rgba(255,255,255,0.02)",
            border:
              selectedId === q.id
                ? "1px solid #0ea5e9"
                : "1px solid rgba(255,255,255,0.06)",
          }}
          data-testid={`quota-picker-${q.id}`}
        >
          <div className="flex items-center gap-1.5 mb-1">
            {q.kind === "royalty" ? (
              <Coins className="h-3 w-3 text-amber-400" />
            ) : (
              <Sparkles className="h-3 w-3 text-sky-400" />
            )}
            <span className="text-sm font-semibold text-white truncate">
              {q.title}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            {formatQuotaRateLabel(q)}
          </div>
        </button>
      ))}
    </div>
  );
}
