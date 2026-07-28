import { useGetPublicIceConfig } from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Network, Router, Wifi } from "lucide-react";

const cardStyle = {
  background: "#0a1018",
  border: "1px solid rgba(255,255,255,0.06)",
} as const;

function iceServerHasTurn(urls: string): boolean {
  return /^(turn|turns):/i.test(urls);
}

export function IceConnectivityHints() {
  const { data, isLoading, isError } = useGetPublicIceConfig();

  const hasTurn =
    data?.iceServers?.some((s) => iceServerHasTurn(s.urls)) ?? false;
  const stunCount =
    data?.iceServers?.filter((s) => /^stun:/i.test(s.urls)).length ?? 0;

  return (
    <Card style={cardStyle} data-testid="ice-connectivity-hints">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-white text-base">
          <Network className="h-4 w-4 text-sky-400" />
          Связь с игроком
        </CardTitle>
        <CardDescription className="text-slate-500 text-xs">
          Как игрок подключается к вашему стриму — без технических терминов в интерфейсе игрока,
          но важно для диагностики на стороне хоста.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : isError ? (
          <p className="text-xs text-amber-300">
            Не удалось проверить настройки платформы — при проблемах с подключением открой чеклист
            агента выше.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className="border text-[10px] font-mono"
              style={{
                background: "rgba(34,197,94,0.08)",
                borderColor: "rgba(34,197,94,0.35)",
                color: "#86efac",
              }}
            >
              <Wifi className="h-3 w-3 mr-1 inline" />
              STUN · {stunCount > 0 ? stunCount : 1}
            </Badge>
            <Badge
              className="border text-[10px] font-mono"
              style={{
                background: hasTurn
                  ? "rgba(168,85,247,0.1)"
                  : "rgba(148,163,184,0.08)",
                borderColor: hasTurn
                  ? "rgba(168,85,247,0.35)"
                  : "rgba(148,163,184,0.25)",
                color: hasTurn ? "#c084fc" : "#94a3b8",
              }}
            >
              <Router className="h-3 w-3 mr-1 inline" />
              {hasTurn ? "Релей (TURN) настроен" : "Релей не настроен"}
            </Badge>
          </div>
        )}

        <ul className="space-y-1.5 text-xs text-slate-400 list-disc pl-5">
          <li>
            <span className="text-slate-300">Прямое соединение</span> — лучший вариант: низкая
            задержка, когда сеть и файрвол позволяют.
          </li>
          <li>
            <span className="text-slate-300">Через STUN</span> — нормально для большинства домашних
            сетей; игрок видит только «подключено».
          </li>
          <li>
            <span className="text-slate-300">Через релей</span> — если у игрока жёсткий файрвол или
            CGNAT; задержка может вырасти. На платформе релей{" "}
            {hasTurn ? "доступен" : "не настроен — сложные сети могут не подключиться"}.
          </li>
          <li>
            Если игрок не подключается: проверь, что агент онлайн, UDP не блокируется, и попробуй
            тест-сессию «Проверить самому» выше.
          </li>
        </ul>
      </CardContent>
    </Card>
  );
}
