import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, Router, Server, Wifi } from "lucide-react";

const cardStyle = {
  background: "#0a1018",
  border: "1px solid rgba(255,255,255,0.06)",
} as const;

type IceConfigState =
  | { status: "loading" }
  | {
      status: "ready";
      hasTurn: boolean;
      hasStun: boolean;
      serverCount: number;
    }
  | { status: "error" };

export function WebRtcConnectivityCard() {
  const [ice, setIce] = useState<IceConfigState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}api/public/ice-config`);
        if (!res.ok) throw new Error("ice-config failed");
        const data = (await res.json()) as { iceServers?: { urls: string | string[] }[] };
        const servers = data.iceServers ?? [];
        const urls = servers.flatMap((s) =>
          Array.isArray(s.urls) ? s.urls : [s.urls],
        );
        const hasTurn = urls.some((u) => u.startsWith("turn:") || u.startsWith("turns:"));
        const hasStun = urls.some((u) => u.startsWith("stun:") || u.startsWith("stuns:"));
        if (!cancelled) {
          setIce({
            status: "ready",
            hasTurn,
            hasStun,
            serverCount: servers.length,
          });
        }
      } catch {
        if (!cancelled) setIce({ status: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card style={cardStyle} data-testid="webrtc-connectivity-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-white flex items-center gap-2">
          <Wifi className="h-4 w-4 text-sky-400" />
          WebRTC / NAT
        </CardTitle>
        <CardDescription className="text-xs text-slate-500">
          Как игроки подключаются к твоему стриму через интернет.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {ice.status === "loading" && (
          <p className="text-xs text-slate-500">Проверяем ICE-серверы…</p>
        )}
        {ice.status === "error" && (
          <p className="text-xs text-amber-300">
            Не удалось загрузить конфиг ICE. Используется только публичный STUN Google.
          </p>
        )}
        {ice.status === "ready" && (
          <div className="flex flex-wrap gap-2">
            <Badge
              variant="outline"
              className="text-[10px] gap-1"
              style={{
                background: ice.hasStun ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.04)",
                borderColor: ice.hasStun ? "rgba(34,197,94,0.35)" : "rgba(255,255,255,0.1)",
                color: ice.hasStun ? "#86efac" : "#94a3b8",
              }}
            >
              <Globe className="h-3 w-3" />
              STUN {ice.hasStun ? "включён" : "не настроен"}
            </Badge>
            <Badge
              variant="outline"
              className="text-[10px] gap-1"
              style={{
                background: ice.hasTurn ? "rgba(168,85,247,0.1)" : "rgba(245,158,11,0.08)",
                borderColor: ice.hasTurn ? "rgba(168,85,247,0.35)" : "rgba(245,158,11,0.3)",
                color: ice.hasTurn ? "#c084fc" : "#fbbf24",
              }}
            >
              <Router className="h-3 w-3" />
              TURN {ice.hasTurn ? "включён" : "не настроен"}
            </Badge>
            <Badge variant="outline" className="text-[10px] text-slate-500 border-white/10">
              <Server className="h-3 w-3 mr-1" />
              {ice.serverCount} сервер(ов)
            </Badge>
          </div>
        )}

        <ul className="text-xs text-slate-400 space-y-1.5 list-disc pl-4">
          <li>
            <span className="text-slate-300">P2P</span> — прямое соединение, минимальная задержка.
            Работает, если у обоих открыты порты или симметричный NAT.
          </li>
          <li>
            <span className="text-slate-300">STUN</span> — помогает узнать внешний IP за NAT.
            Без него часть игроков не подключится.
          </li>
          <li>
            <span className="text-slate-300">TURN</span> — релей через сервер, если P2P не
            проходит (строгий NAT, корпоративная сеть). Настрой{" "}
            <span className="font-mono text-sky-400">TURN_URL</span> в .env сервера.
          </li>
        </ul>

        {ice.status === "ready" && !ice.hasTurn && (
          <p
            className="text-[11px] text-amber-300/90 rounded-md px-2 py-1.5"
            style={{ background: "rgba(245,158,11,0.08)" }}
          >
            TURN не настроен — часть игроков за жёстким NAT может видеть «Связь пропала».
            Добавь coturn (см. <span className="font-mono">infra/coturn/</span>).
          </p>
        )}
      </CardContent>
    </Card>
  );
}
