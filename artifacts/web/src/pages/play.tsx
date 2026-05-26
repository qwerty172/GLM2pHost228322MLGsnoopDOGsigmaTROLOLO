import { useCallback, useEffect, useRef, useState } from "react";
import { useRoute, Link } from "wouter";
import {
  useGetSessionByPlayerToken,
  getGetSessionByPlayerTokenQueryKey,
  useClaimSession,
  useGetWallet,
  getGetWalletQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gamepad2, AlertCircle, ArrowLeft, Loader2, Wifi, WifiOff, VolumeX, Wallet, Banknote, Coins, Clock, TrendingDown } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

const LZT_PER_USDT = 200;
type PaymentSource = "auto" | "blue" | "green";
import { toast } from "sonner";
import { usePlayerWallet } from "@/hooks/use-player-wallet";

export default function Play() {
  const [, params] = useRoute("/play/:playerToken");
  const playerToken = params?.playerToken || "";

  const { data: session, isLoading, isError } = useGetSessionByPlayerToken(playerToken, {
    query: {
      enabled: !!playerToken,
      queryKey: getGetSessionByPlayerTokenQueryKey(playerToken),
      refetchInterval: 8000,
    }
  });

  const { playerWalletToken } = usePlayerWallet();
  const { data: wallet } = useGetWallet(playerWalletToken || "", {
    query: {
      enabled: !!playerWalletToken,
      queryKey: getGetWalletQueryKey(playerWalletToken || ""),
      refetchInterval: 30000,
    },
  });
  const claimSession = useClaimSession();
  const [claimError, setClaimError] = useState<string | null>(null);
  const [hasClaimed, setHasClaimed] = useState(false);
  const [paymentSource, setPaymentSource] = useState<PaymentSource>("auto");

  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>("new");
  const [isPlaying, setIsPlaying] = useState(false);
  const [showAudioPrompt, setShowAudioPrompt] = useState(false);

  // Live HUD: client-side ticking balance estimate between API syncs
  const [estimatedBalanceLzt, setEstimatedBalanceLzt] = useState<number | null>(null);
  const ratePerSecLztRef = useRef<number>(0);
  const sessionEndReasonRef = useRef<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const startedRef = useRef(false);

  // Sync estimated balance from actual wallet data (30s API sync)
  useEffect(() => {
    if (!wallet || !session) return;
    const greenLzt = wallet.withdrawableBalanceLzt ?? 0;
    const blueLzt = wallet.internalBalanceLzt ?? 0;
    const src = (session as typeof session & { paymentSource?: string }).paymentSource ?? "auto";
    const bal = src === "blue" ? blueLzt : src === "green" ? greenLzt : greenLzt + blueLzt;
    setEstimatedBalanceLzt(bal);
    const rateLztPerMin = Math.round(Number(session.ratePerMinute) * LZT_PER_USDT);
    ratePerSecLztRef.current = rateLztPerMin / 60;
  }, [wallet, session]);

  // Tick every second to drain the estimated balance
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      setEstimatedBalanceLzt((prev) => {
        if (prev === null) return prev;
        return Math.max(0, prev - ratePerSecLztRef.current);
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isPlaying]);

  // Detect host_offline and balance_exhausted end reasons
  useEffect(() => {
    if (!session) return;
    const reason = (session as typeof session & { endReason?: string | null }).endReason ?? null;
    sessionEndReasonRef.current = reason;
    if (session.status === "ended" && isPlaying) {
      if (reason === "host_offline") {
        toast.error("Хост отключился. Списания остановлены.");
      } else if (reason === "balance_exhausted") {
        toast.error("Баланс исчерпан. Сессия завершена.");
      }
    }
  }, [session?.status, (session as typeof session & { endReason?: string | null })?.endReason, isPlaying]);

  const cleanupConnection = useCallback(() => {
    if (dcRef.current) {
      dcRef.current.close();
      dcRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    startedRef.current = false;
    setIsPlaying(false);
    setConnectionState("closed");
  }, []);

  const startConnection = useCallback(async () => {
    if (!playerToken || startedRef.current) return;
    startedRef.current = true;

    setIsPlaying(true);
    setConnectionState("connecting");

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    if (!playerWalletToken) return;
    const wsUrl = `${wsProtocol}//${window.location.host}${import.meta.env.BASE_URL}api/signal?role=player&playerToken=${playerToken}&playerWalletToken=${playerWalletToken}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });
    pcRef.current = pc;

    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected" || pc.connectionState === "closed") {
        cleanupConnection();
        toast.error("Соединение потеряно");
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ice-candidate", candidate: event.candidate }));
      }
    };

    pc.ontrack = (event) => {
      if (videoRef.current && event.streams[0]) {
        videoRef.current.srcObject = event.streams[0];
        videoRef.current.play().catch(() => {
          setShowAudioPrompt(true);
        });
      }
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          ws.send(JSON.stringify({ type: "answer", sdp: answer }));
        } else if (msg.type === "ice-candidate") {
          await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
        } else if (msg.type === "control" && msg.action === "reject") {
          // Host explicitly rejected this player: host_busy or game_unavailable.
          const reason: string = msg.reason ?? "unknown";
          const msgText =
            reason === "host_busy"
              ? "Хост сейчас занят с другим игроком. Попробуй позже."
              : reason === "game_unavailable"
                ? "Игра временно недоступна на этом хосте."
                : `Хост отклонил соединение (${reason}).`;
          toast.error(msgText);
          cleanupConnection();
        }
      } catch (err) {
        console.error("Error handling WS message", err);
      }
    };

    ws.onopen = () => {
      // Create data channel for inputs
      const dc = pc.createDataChannel("input");
      dcRef.current = dc;
    };

    ws.onerror = () => {
      toast.error("Ошибка сигнального сервера");
      cleanupConnection();
    };
  }, [playerToken, playerWalletToken, cleanupConnection]);

  useEffect(() => {
    if (
      !session ||
      session.status === "ended" ||
      !playerWalletToken ||
      hasClaimed ||
      claimSession.isPending
    ) {
      return;
    }
    if (session.claimedByPlayerId) {
      setHasClaimed(true);
      return;
    }
    claimSession.mutate(
      {
        playerToken,
        data: { playerWalletToken, paymentSource },
      },
      {
        onSuccess: () => {
          setHasClaimed(true);
          setClaimError(null);
        },
        onError: (err: unknown) => {
          const msg =
            err instanceof Error
              ? err.message
              : typeof err === "string"
                ? err
                : "Failed to claim session";
          setClaimError(msg);
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, playerWalletToken, hasClaimed]);

  useEffect(() => {
    if (
      session &&
      session.status !== "ended" &&
      hasClaimed &&
      !startedRef.current
    ) {
      void startConnection();
    }
    return () => {
      cleanupConnection();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, hasClaimed]);

  const handleEnableAudio = () => {
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.play().then(() => {
        setShowAudioPrompt(false);
      }).catch(console.error);
    }
  };

  // Input Capture
  useEffect(() => {
    if (!isPlaying) return;

    // Shared wire format with the host's input replayer. x/y are normalized
    // 0..1 relative to the host canvas, so the host can map them back to
    // canvas-local pixel coordinates without knowing the guest's viewport.
    type KeyInput = {
      type: "input";
      kind: "key";
      action: "down" | "up";
      key: string;
      code: string;
    };
    type MouseInput = {
      type: "input";
      kind: "mouse";
      action: "down" | "up" | "move";
      button: number;
      x: number;
      y: number;
    };
    type WheelInput = {
      type: "input";
      kind: "wheel";
      deltaY: number;
      x: number;
      y: number;
    };
    type InputEvent = KeyInput | MouseInput | WheelInput;

    const sendInput = (data: InputEvent) => {
      if (dcRef.current && dcRef.current.readyState === "open") {
        dcRef.current.send(JSON.stringify(data));
      }
    };

    const normalizedCoords = (e: MouseEvent | WheelEvent) => {
      const v = videoRef.current;
      if (!v) return { x: 0.5, y: 0.5 };
      const rect = v.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return { x: 0.5, y: 0.5 };
      const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
      return { x, y };
    };

    const isOverVideo = (e: MouseEvent | WheelEvent) => {
      const v = videoRef.current;
      if (!v) return false;
      const r = v.getBoundingClientRect();
      return (
        e.clientX >= r.left &&
        e.clientX <= r.right &&
        e.clientY >= r.top &&
        e.clientY <= r.bottom
      );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      sendInput({
        type: "input",
        kind: "key",
        action: "down",
        key: e.key,
        code: e.code,
      });
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      sendInput({
        type: "input",
        kind: "key",
        action: "up",
        key: e.key,
        code: e.code,
      });
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (!isOverVideo(e)) return;
      const { x, y } = normalizedCoords(e);
      sendInput({ type: "input", kind: "mouse", action: "down", button: e.button, x, y });
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!isOverVideo(e)) return;
      const { x, y } = normalizedCoords(e);
      sendInput({ type: "input", kind: "mouse", action: "up", button: e.button, x, y });
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isOverVideo(e)) return;
      const { x, y } = normalizedCoords(e);
      sendInput({ type: "input", kind: "mouse", action: "move", button: 0, x, y });
    };

    const handleWheel = (e: WheelEvent) => {
      if (!isOverVideo(e)) return;
      e.preventDefault();
      const { x, y } = normalizedCoords(e);
      sendInput({ type: "input", kind: "wheel", deltaY: e.deltaY, x, y });
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("wheel", handleWheel);
    };
  }, [isPlaying]);

  const requestPointerLock = () => {
    if (videoRef.current && isPlaying) {
      videoRef.current.requestPointerLock();
    }
  };

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#06090e" }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
      </div>
    );
  }

  if (isError || !session) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: "#06090e" }}
      >
        <Card
          className="w-full max-w-md"
          style={{
            background: "rgba(239,68,68,0.05)",
            border: "1px solid rgba(239,68,68,0.3)",
          }}
        >
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <CardTitle className="text-white">Сессия не найдена</CardTitle>
            <CardDescription className="text-slate-500">
              Ссылка некорректна или больше не действует.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!isPlaying) {
    const greenLzt = wallet?.withdrawableBalanceLzt ?? 0;
    const blueLzt = wallet?.internalBalanceLzt ?? 0;
    const totalLzt = greenLzt + blueLzt;
    const ratePerMinUsd = session.ratePerMinute;
    const ratePerMinLzt = Math.round(ratePerMinUsd * LZT_PER_USDT);
    const sourceBalance =
      paymentSource === "blue"
        ? blueLzt
        : paymentSource === "green"
          ? greenLzt
          : totalLzt;
    const minutesAffordable =
      ratePerMinLzt > 0 ? Math.floor(sourceBalance / ratePerMinLzt) : 0;
    const sourceLabel: Record<PaymentSource, string> = {
      auto: "Авто (зелёный → синий)",
      green: "Зелёный (выводимый)",
      blue: "Синий (внутренний)",
    };
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
        style={{ background: "#06090e" }}
      >
        <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,rgba(14,165,233,0.1),transparent_50%)]" />
        <Card
          className="w-full max-w-md relative z-10"
          style={{
            background: "#0a1018",
            border: "1px solid rgba(14,165,233,0.2)",
          }}
        >
          <CardHeader className="text-center pb-6">
            {(() => {
              const s = session as typeof session & { gameSlug?: string | null; gameCoverImageUrl?: string | null; gameTitle?: string | null };
              const cover = s.gameCoverImageUrl
                ? s.gameCoverImageUrl.startsWith("http")
                  ? s.gameCoverImageUrl
                  : `${import.meta.env.BASE_URL}${s.gameCoverImageUrl.replace(/^\//, "")}`
                : null;
              return cover ? (
                <div className="w-28 h-36 mx-auto mb-4 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                  <img src={cover} alt={s.appName} className="w-full h-full object-cover" />
                </div>
              ) : (
                <Gamepad2 className="h-16 w-16 text-sky-400 mx-auto mb-6" />
              );
            })()}
            {(() => {
              const s = session as typeof session & { gameSlug?: string | null };
              return s.gameSlug ? (
                <Link href={`/games/${s.gameSlug}`}>
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-sky-400 transition-colors cursor-pointer mb-2">
                    <ArrowLeft className="h-3 w-3" />
                    К игре
                  </span>
                </Link>
              ) : null;
            })()}
            <CardTitle className="text-3xl font-bold tracking-tight mb-2 text-white">
              {(session as any).gameTitle || session.appName}
            </CardTitle>
            <div className="flex items-center justify-center gap-2 text-xs text-slate-500 font-mono flex-wrap">
              <Badge
                variant="outline"
                className="border-white/10 text-slate-400"
              >
                {session.resolution}
              </Badge>
              <Badge
                variant="outline"
                className="border-white/10 text-slate-400"
              >
                {session.bitrateKbps} kbps
              </Badge>
              <Badge
                variant="outline"
                className="border-sky-400/30 text-sky-300"
              >
                🔵 {ratePerMinLzt} LZT/мин
              </Badge>
              <Badge
                variant="outline"
                className="border-white/10 text-slate-500 text-[10px]"
              >
                ≈ ${ratePerMinUsd.toFixed(4)}/мин
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div
                className="rounded-lg p-3"
                style={{
                  background: "rgba(14,165,233,0.1)",
                  border: "1px solid rgba(14,165,233,0.3)",
                }}
              >
                <div className="text-[10px] uppercase text-sky-300 flex items-center gap-1">
                  <Wallet className="h-3 w-3" /> Синий
                </div>
                <div className="font-bold font-mono text-sky-300">
                  {blueLzt.toLocaleString("ru-RU")} LZT
                </div>
                <div className="text-[10px] text-slate-500">
                  ≈ ${(blueLzt / LZT_PER_USDT).toFixed(2)}
                </div>
              </div>
              <div
                className="rounded-lg p-3"
                style={{
                  background: "rgba(16,185,129,0.1)",
                  border: "1px solid rgba(16,185,129,0.3)",
                }}
              >
                <div className="text-[10px] uppercase text-emerald-300 flex items-center gap-1">
                  <Banknote className="h-3 w-3" /> Зелёный
                </div>
                <div className="font-bold font-mono text-emerald-300">
                  {greenLzt.toLocaleString("ru-RU")} LZT
                </div>
                <div className="text-[10px] text-slate-500">
                  ≈ ${(greenLzt / LZT_PER_USDT).toFixed(2)}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Coins className="h-3 w-3" /> Источник оплаты
              </Label>
              <RadioGroup
                value={paymentSource}
                onValueChange={(v) => setPaymentSource(v as PaymentSource)}
                className="grid grid-cols-3 gap-2"
                disabled={hasClaimed}
              >
                {(["auto", "green", "blue"] as PaymentSource[]).map((s) => (
                  <div key={s}>
                    <RadioGroupItem value={s} id={`src-${s}`} className="peer sr-only" />
                    <Label
                      htmlFor={`src-${s}`}
                      className="flex flex-col items-center justify-center rounded-md p-2 cursor-pointer transition-all text-center text-xs text-slate-300"
                      style={{
                        background:
                          paymentSource === s
                            ? "rgba(14,165,233,0.12)"
                            : "rgba(255,255,255,0.02)",
                        border:
                          paymentSource === s
                            ? "2px solid #0ea5e9"
                            : "2px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <span className="font-bold capitalize">
                        {s === "auto" ? "Авто" : s === "green" ? "Зелёный" : "Синий"}
                      </span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              <p className="text-[10px] text-slate-500">
                {sourceLabel[paymentSource]} · ~{minutesAffordable} мин игры
              </p>
            </div>

            <div
              className="flex items-center justify-between p-4 rounded-lg"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="text-sm font-medium text-slate-400">
                Статус хоста
              </div>
              <Badge
                variant="outline"
                style={{
                  background:
                    session.status === "active"
                      ? "rgba(20,184,166,0.15)"
                      : "rgba(255,255,255,0.04)",
                  color: session.status === "active" ? "#2dd4bf" : "#94a3b8",
                  border:
                    session.status === "active"
                      ? "1px solid rgba(20,184,166,0.3)"
                      : "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {session.status === "active"
                  ? "АКТИВЕН"
                  : session.status === "pending"
                    ? "ОЖИДАНИЕ"
                    : "ЗАВЕРШЁН"}
              </Badge>
            </div>

            {claimError && (
              <div
                className="p-3 rounded-md text-sm"
                style={{
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  color: "#fca5a5",
                }}
              >
                {claimError}
              </div>
            )}
            {!playerWalletToken || claimSession.isPending ? (
              <Button
                className="w-full h-14 text-base font-bold"
                disabled
                style={{ background: "rgba(14,165,233,0.2)", color: "#fff" }}
              >
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {playerWalletToken
                  ? "Подключаемся к сессии…"
                  : "Создаём кошелёк…"}
              </Button>
            ) : sourceBalance < ratePerMinLzt && !hasClaimed ? (
              <Link href="/wallet" className="block">
                <Button
                  className="w-full h-14 text-base font-bold"
                  style={{ background: "#0ea5e9", color: "#fff" }}
                >
                  Пополнить кошелёк
                </Button>
              </Link>
            ) : (
              <Button
                className="w-full h-14 text-base font-bold"
                style={{ background: "#0ea5e9", color: "#fff" }}
                onClick={() => void startConnection()}
                disabled={session.status === "ended"}
              >
                {session.status === "ended"
                  ? "Сессия завершена"
                  : "Подключиться и играть"}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col relative overflow-hidden select-none">
      {/* Host offline modal */}
      {session?.status === "ended" && (session as typeof session & { endReason?: string | null }).endReason === "host_offline" && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <Card className="w-full max-w-sm mx-4" style={{ background: "#0a1018", border: "1px solid rgba(239,68,68,0.4)" }}>
            <CardHeader className="text-center pb-2">
              <WifiOff className="h-10 w-10 text-red-400 mx-auto mb-3" />
              <CardTitle className="text-white">Хост отключился</CardTitle>
              <CardDescription className="text-slate-400">
                Сессия завершена автоматически. Деньги не списывались с момента пропажи связи.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/games">
                <Button className="w-full" style={{ background: "#0ea5e9", color: "#fff" }}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Назад в каталог
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Balance exhausted modal */}
      {session?.status === "ended" && (session as typeof session & { endReason?: string | null }).endReason === "balance_exhausted" && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <Card className="w-full max-w-sm mx-4" style={{ background: "#0a1018", border: "1px solid rgba(234,179,8,0.4)" }}>
            <CardHeader className="text-center pb-2">
              <Coins className="h-10 w-10 text-yellow-400 mx-auto mb-3" />
              <CardTitle className="text-white">Баланс исчерпан</CardTitle>
              <CardDescription className="text-slate-400">
                Сессия завершена — на балансе не хватило LZT для следующей минуты.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Link href="/wallet">
                <Button className="w-full" style={{ background: "#0ea5e9", color: "#fff" }}>
                  Пополнить кошелёк
                </Button>
              </Link>
              <Link href="/games">
                <Button variant="outline" className="w-full border-white/10 text-slate-300">
                  <ArrowLeft className="h-4 w-4 mr-2" /> В каталог
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-50 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <div className="flex items-center gap-4">
          <div className="font-bold text-sky-400 tracking-tight drop-shadow-md">
            DecentralHub
          </div>
          <Badge
            variant="outline"
            className="bg-black/50 backdrop-blur font-mono"
            style={{
              borderColor:
                connectionState === "connected" ? "#0ea5e9" : "#ef4444",
              color: connectionState === "connected" ? "#38bdf8" : "#f87171",
            }}
          >
            {connectionState === "connected" ? (
              <Wifi className="w-3 h-3 mr-2 inline" />
            ) : (
              <WifiOff className="w-3 h-3 mr-2 inline" />
            )}
            {connectionState === "connected"
              ? "ПОДКЛЮЧЕНО"
              : connectionState === "connecting"
                ? "СОЕДИНЕНИЕ"
                : connectionState.toUpperCase()}
          </Badge>
        </div>

        {/* Live balance HUD */}
        {estimatedBalanceLzt !== null && session && (() => {
          const rateLztPerMin = Math.round(Number(session.ratePerMinute) * LZT_PER_USDT);
          const minsLeft = rateLztPerMin > 0 ? Math.floor(estimatedBalanceLzt / rateLztPerMin) : 999;
          const isWarning = minsLeft < 5 && minsLeft >= 2;
          const isDanger = minsLeft < 2;
          const hudColor = isDanger ? "#ef4444" : isWarning ? "#eab308" : "#38bdf8";
          const hudBg = isDanger ? "rgba(239,68,68,0.15)" : isWarning ? "rgba(234,179,8,0.12)" : "rgba(14,165,233,0.1)";
          const hudBorder = isDanger ? "rgba(239,68,68,0.4)" : isWarning ? "rgba(234,179,8,0.35)" : "rgba(14,165,233,0.25)";
          return (
            <div
              className="flex items-center gap-3 rounded-lg px-3 py-1.5 pointer-events-none"
              style={{ background: hudBg, border: `1px solid ${hudBorder}` }}
            >
              {isDanger && <TrendingDown className="w-3.5 h-3.5 animate-pulse" style={{ color: hudColor }} />}
              <div className="text-right">
                <div className="font-mono font-bold text-sm leading-none" style={{ color: hudColor }}>
                  {estimatedBalanceLzt.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} LZT
                </div>
                <div className="font-mono text-[10px] mt-0.5" style={{ color: hudColor, opacity: 0.75 }}>
                  <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                  {minsLeft >= 999 ? "∞" : `~${minsLeft} мин`}
                </div>
              </div>
            </div>
          );
        })()}

        <Button
          size="sm"
          onClick={cleanupConnection}
          className="pointer-events-auto shadow-md"
          style={{
            background: "rgba(239,68,68,0.85)",
            color: "#fff",
          }}
        >
          Отключиться
        </Button>
      </div>

      <div className="flex-1 relative flex items-center justify-center bg-black cursor-crosshair">
        {connectionState !== "connected" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-40 backdrop-blur-sm">
            <Loader2 className="h-12 w-12 animate-spin text-sky-400 mb-4" />
            <div className="font-mono text-sky-400 font-bold tracking-widest uppercase">
              Устанавливаем WebRTC-соединение
            </div>
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={false}
          className="w-full h-full object-contain pointer-events-auto"
          onClick={requestPointerLock}
        />

        {showAudioPrompt && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-30 pointer-events-auto">
            <Button
              size="lg"
              onClick={handleEnableAudio}
              className="font-bold gap-2 shadow-xl hover:scale-105 transition-transform"
              style={{ background: "#0ea5e9", color: "#fff" }}
            >
              <VolumeX className="h-5 w-5" />
              Включить звук
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
