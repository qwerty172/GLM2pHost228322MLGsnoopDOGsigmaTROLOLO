import { useCallback, useEffect, useRef, useState } from "react";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Copy,
  Loader2,
  Wifi,
  WifiOff,
  PowerOff,
  Gamepad2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  useGetSession,
  getGetSessionQueryKey,
  endSession,
} from "@workspace/api-client-react";

const HOST_TOKEN_STORAGE_PREFIX = "streamline.browserHostToken:";
const BROWSER_HOST_URL_STORAGE_PREFIX = "streamline.browserHostUrl:";

function getStoredHostToken(sessionId: string): string | null {
  try {
    // Prefer the session-scoped key; fall back to the global host token so the
    // page works even when the popup was blocked or localStorage was cleared.
    return (
      localStorage.getItem(HOST_TOKEN_STORAGE_PREFIX + sessionId) ||
      localStorage.getItem("streamline.hostToken")
    );
  } catch {
    return null;
  }
}

function getStoredBrowserHostUrl(sessionId: string): string | null {
  try {
    return localStorage.getItem(BROWSER_HOST_URL_STORAGE_PREFIX + sessionId);
  } catch {
    return null;
  }
}

export default function BrowserPlay() {
  const [, params] = useRoute("/host/play/:sessionId");
  const sessionId = params?.sessionId || "";
  const hostToken = sessionId ? getStoredHostToken(sessionId) : null;
  // localStorage key may be absent (popup blocked, different device, etc.).
  // Resolve after the session API call returns.
  const storedBrowserHostUrl = sessionId ? getStoredBrowserHostUrl(sessionId) : null;

  const { data: session, isLoading: sessionLoading } = useGetSession(
    sessionId,
    { hostToken: hostToken || "" },
    {
      query: {
        enabled: !!sessionId && !!hostToken,
        queryKey: getGetSessionQueryKey(sessionId, { hostToken: hostToken || "" }),
        refetchInterval: 10000,
      },
    },
  );

  // Derive browserHostUrl: prefer localStorage, fall back to session.appName
  // when it looks like an external URL (test sessions store the boundUrl there).
  const browserHostUrl: string | null =
    storedBrowserHostUrl ||
    (/^https?:\/\//i.test(session?.appName ?? "") ? (session?.appName ?? null) : null);

  // True when the host is streaming an arbitrary external https site via tab
  // capture (getDisplayMedia). Defined here so handleInputMessage can use it.
  const isExternal = /^https?:\/\//i.test(browserHostUrl ?? "");

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const externalStreamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const inputDcRef = useRef<RTCDataChannel | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamingStartedRef = useRef(false);

  const [iframeReady, setIframeReady] = useState(false);
  const [canvasFound, setCanvasFound] = useState(false);
  const [tabCaptured, setTabCaptured] = useState(false);
  const [connectionState, setConnectionState] =
    useState<RTCPeerConnectionState>("new");
  const [shareUrl, setShareUrl] = useState<string>("");
  const [audioCaptured, setAudioCaptured] = useState(false);
  const [earnedLzt, setEarnedLzt] = useState(0);

  useEffect(() => {
    if (!session) return;
    const origin = window.location.origin;
    const base = import.meta.env.BASE_URL;
    setShareUrl(
      `${origin}${base.replace(/\/$/, "")}/play/${session.playerToken}`,
    );
  }, [session]);

  // Find the game's main canvas inside the iframe once it has loaded.
  useEffect(() => {
    if (!iframeReady) return;
    let cancelled = false;
    const tryFind = () => {
      if (cancelled) return;
      const doc = iframeRef.current?.contentDocument;
      const cnv = doc?.querySelector("canvas") as HTMLCanvasElement | null;
      if (cnv) {
        canvasRef.current = cnv;
        setCanvasFound(true);
      } else {
        setTimeout(tryFind, 250);
      }
    };
    tryFind();
    return () => {
      cancelled = true;
    };
  }, [iframeReady]);

  const cleanup = useCallback(() => {
    // Stop tab capture explicitly so the browser's "sharing" indicator goes
    // away even when the session is ended from our UI.
    externalStreamRef.current?.getTracks().forEach((t) => t.stop());
    externalStreamRef.current = null;
    inputDcRef.current?.close();
    inputDcRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    if (pcRef.current) {
      const poll = (pcRef.current as unknown as { __audioPoll?: number })
        .__audioPoll;
      if (poll) clearInterval(poll as unknown as NodeJS.Timeout);
      pcRef.current.close();
      pcRef.current = null;
    }
    streamingStartedRef.current = false;
  }, []);

  const startStreaming = useCallback(async (externalStream?: MediaStream) => {
    if (!sessionId || !hostToken || streamingStartedRef.current) return;
    const canvas = canvasRef.current;
    if (!externalStream && !canvas) return;
    streamingStartedRef.current = true;
    setConnectionState("connecting");
    if (externalStream) externalStreamRef.current = externalStream;

    try {
    const videoStream = externalStream ?? canvas!.captureStream(30);

    // Fetch ICE server config (STUN + optional TURN) from the API.
    let iceServers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
    try {
      const cfgRes = await fetch(`${import.meta.env.BASE_URL}api/public/ice-config`);
      if (cfgRes.ok) {
        const cfgJson = (await cfgRes.json()) as { iceServers: RTCIceServer[] };
        if (Array.isArray(cfgJson.iceServers) && cfgJson.iceServers.length > 0) {
          // Sanitize: drop entries whose urls are not valid ICE URIs so a
          // bad server config can never hard-crash RTCPeerConnection.
          const valid = cfgJson.iceServers.filter((s) => {
            const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
            return urls.every(
              (u) => typeof u === "string" && /^(stun|stuns|turn|turns):/i.test(u),
            );
          });
          if (valid.length > 0) iceServers = valid;
        }
      }
    } catch {
      console.warn("[ice] Failed to fetch ICE config, using default STUN only");
    }

    const pc = new RTCPeerConnection({ iceServers });
    pcRef.current = pc;
    for (const track of videoStream.getVideoTracks()) {
      pc.addTrack(track, videoStream);
    }

    // External tab capture already carries its own audio track (if the host
    // ticked "share tab audio" in the browser dialog) — just forward it.
    if (externalStream) {
      for (const track of externalStream.getAudioTracks()) {
        pc.addTrack(track, externalStream);
        setAudioCaptured(true);
      }
    }

    // Audio: route every <audio> element Phaser creates inside the iframe
    // through a shared Web Audio destination, then add that as a single
    // outbound track. We poll for new audio elements every couple seconds
    // (Phaser creates them lazily on first play). Same-origin iframe means
    // we can construct MediaElementSource without CORS errors.
    try {
      const AC: typeof AudioContext =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AC) {
        const ac = new AC();
        const dest = ac.createMediaStreamDestination();
        const wired = new WeakSet<HTMLMediaElement>();
        const wireAudio = () => {
          const doc = iframeRef.current?.contentDocument;
          if (!doc) return;
          const els = doc.querySelectorAll<HTMLMediaElement>("audio, video");
          els.forEach((el) => {
            if (wired.has(el)) return;
            try {
              const src = ac.createMediaElementSource(el);
              src.connect(dest);
              // Also keep the element audible locally so the host can hear
              // their own game.
              src.connect(ac.destination);
              wired.add(el);
              setAudioCaptured(true);
            } catch {
              // already connected to another graph — ignore
            }
          });
        };
        wireAudio();
        const audioPoll = setInterval(wireAudio, 2000);
        // Park the interval on the peer connection so cleanup() clears it.
        (pc as unknown as { __audioPoll?: number }).__audioPoll =
          audioPoll as unknown as number;
        for (const track of dest.stream.getAudioTracks()) {
          pc.addTrack(track, dest.stream);
        }
      }
    } catch (err) {
      console.warn("Browser host: audio capture unavailable", err);
    }

    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
    };

    // The Guest creates the "input" data channel — we handle it here on
    // ondatachannel and dispatch the events into the game iframe.
    pc.ondatachannel = (ev) => {
      if (ev.channel.label !== "input") return;
      inputDcRef.current = ev.channel;
      ev.channel.onmessage = (m) => handleInputMessage(m.data);
    };

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl =
      `${wsProtocol}//${window.location.host}${import.meta.env.BASE_URL}api/signal` +
      `?role=host&sessionId=${encodeURIComponent(sessionId)}` +
      `&hostToken=${encodeURIComponent(hostToken)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    pc.onicecandidate = (event) => {
      if (event.candidate && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({ type: "ice-candidate", candidate: event.candidate }),
        );
      }
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "answer") {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        } else if (msg.type === "ice-candidate") {
          await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
        } else if (msg.type === "peer-joined" && msg.role === "player") {
          // Renegotiate from the host side once the player is in the room.
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          ws.send(JSON.stringify({ type: "offer", sdp: offer }));
        }
      } catch (err) {
        console.error("Browser host: signaling error", err);
      }
    };

    ws.onerror = () => {
      toast.error("Сигнальный сервер недоступен");
    };
    } catch (err) {
      // Any hard setup failure (e.g. RTCPeerConnection rejecting a bad ICE
      // config) must not leave the page in a dead state — reset so the host
      // can retry.
      console.error("Browser host: failed to start streaming", err);
      cleanup();
      streamingStartedRef.current = false;
      setConnectionState("closed");
      toast.error("Не удалось запустить стрим — попробуй ещё раз");
    }
  }, [sessionId, hostToken, cleanup]);

  // Auto-start once iframe canvas is ready.
  useEffect(() => {
    if (canvasFound) void startStreaming();
  }, [canvasFound, startStreaming]);

  const handleInputMessage = (raw: unknown) => {
    const canvas = canvasRef.current;
    let msg: {
      type?: string;
      kind?: string;
      action?: string;
      key?: string;
      code?: string;
      button?: number;
      x?: number;
      y?: number;
      deltaY?: number;
    };
    try {
      msg = typeof raw === "string" ? JSON.parse(raw) : (raw as never);
    } catch {
      return;
    }
    if (msg.type !== "input") return;

    // External URL (tab capture) mode: relay input events to the local
    // host-agent at localhost:18080/input so Win32 SendInput can replay them
    // at the OS level. This makes the player's mouse/keyboard affect whatever
    // the host has focused on their screen (typically the captured tab).
    if (isExternal) {
      const x = msg.x ?? 0.5;
      const y = msg.y ?? 0.5;
      const buttonName =
        msg.button === 2 ? "right" : msg.button === 1 ? "middle" : "left";
      let event: Record<string, unknown> | null = null;
      if (msg.kind === "key") {
        event = {
          kind: msg.action === "up" ? "keyup" : "keydown",
          code: msg.code || msg.key || "",
          key: msg.key || msg.code || "",
        };
      } else if (msg.kind === "mouse") {
        if (msg.action === "move") {
          event = { kind: "mousemove", x, y, mode: "absolute" };
        } else if (msg.action === "down") {
          // Send move first so the cursor is in the right spot before the click.
          void fetch("http://127.0.0.1:18080/input", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kind: "mousemove", x, y, mode: "absolute" }),
          }).catch(() => undefined);
          event = { kind: "mousedown", button: buttonName };
        } else if (msg.action === "up") {
          event = { kind: "mouseup", button: buttonName };
        }
      } else if (msg.kind === "wheel") {
        event = { kind: "wheel", deltaY: msg.deltaY ?? 0 };
      }
      if (event) {
        void fetch("http://127.0.0.1:18080/input", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(event),
        }).catch(() => undefined);
      }
      return;
    }

    // Iframe/canvas game mode — dispatch events directly into the embedded game.
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const cx = typeof msg.x === "number" ? msg.x * canvas.width : canvas.width / 2;
    const cy =
      typeof msg.y === "number" ? msg.y * canvas.height : canvas.height / 2;
    // Page-relative coordinates for the MouseEvent constructor.
    const clientX = rect.left + (typeof msg.x === "number" ? msg.x * rect.width : rect.width / 2);
    const clientY = rect.top + (typeof msg.y === "number" ? msg.y * rect.height : rect.height / 2);

    if (msg.kind === "key") {
      const evt = new KeyboardEvent(
        msg.action === "up" ? "keyup" : "keydown",
        {
          key: msg.key || msg.code || "",
          code: msg.code || msg.key || "",
          bubbles: true,
          cancelable: true,
        },
      );
      canvas.dispatchEvent(evt);
      // Phaser binds to window.document, so also fan out at document.
      iframeRef.current?.contentDocument?.dispatchEvent(evt);
    } else if (msg.kind === "mouse") {
      const evtType =
        msg.action === "down"
          ? "mousedown"
          : msg.action === "up"
            ? "mouseup"
            : "mousemove";
      const evt = new MouseEvent(evtType, {
        clientX,
        clientY,
        button: msg.button ?? 0,
        buttons: msg.action === "down" ? 1 : 0,
        bubbles: true,
        cancelable: true,
        view: iframeRef.current?.contentWindow ?? window,
      });
      // Override read-only offsetX/Y so Phaser's input plugin sees the
      // click at the right canvas-local position.
      Object.defineProperty(evt, "offsetX", { value: cx, configurable: true });
      Object.defineProperty(evt, "offsetY", { value: cy, configurable: true });
      canvas.dispatchEvent(evt);
    } else if (msg.kind === "wheel") {
      const evt = new WheelEvent("wheel", {
        deltaY: msg.deltaY ?? 0,
        clientX,
        clientY,
        bubbles: true,
        cancelable: true,
      });
      canvas.dispatchEvent(evt);
    }
  };

  useEffect(() => () => cleanup(), [cleanup]);

  // Live earnings ticker — host receives the full per-minute rate on each
  // billing tick (billingWorker splits 50/50 between green/blue buckets).
  // We don't poll the server every second; we just project linearly from
  // session.startedAt at the session's per-minute rate, which matches what
  // billing_events sums to at minute boundaries.
  useEffect(() => {
    if (!session || session.status === "ended" || !session.startedAt) {
      return;
    }
    const startMs = new Date(session.startedAt).getTime();
    const ratePerMinUsd = session.ratePerMinute || 0;
    const ratePerMinLzt = Math.round(ratePerMinUsd * 200);
    const tick = () => {
      const elapsedMin = Math.max(0, (Date.now() - startMs) / 60000);
      setEarnedLzt(Math.floor(elapsedMin * ratePerMinLzt));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session?.id, session?.startedAt, session?.status, session?.ratePerMinute]);

  const handleEndSession = async () => {
    if (!sessionId || !hostToken) return;
    try {
      await endSession(sessionId, { hostToken });
      toast.success("Сессия завершена");
      cleanup();
      try {
        localStorage.removeItem(HOST_TOKEN_STORAGE_PREFIX + sessionId);
        localStorage.removeItem(BROWSER_HOST_URL_STORAGE_PREFIX + sessionId);
      } catch {
        // ignore
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Не удалось завершить сессию",
      );
    }
  };

  // External http(s) URL (arbitrary site like DeepSeek): cross-origin iframes
  // can't be canvas-captured, so the host shares the tab via getDisplayMedia.

  const handleShareTab = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
      });
      setTabCaptured(true);
      // If the host stops sharing from the browser UI, tear down the stream.
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        setTabCaptured(false);
        cleanup();
        setConnectionState("closed");
        toast.info("Показ вкладки остановлен");
      });
      void startStreaming(stream);
    } catch {
      toast.error("Доступ к захвату экрана не предоставлен");
    }
  };

  // Still loading — wait before showing an error so the API-based fallback
  // for browserHostUrl has a chance to resolve.
  if (!sessionId || (!browserHostUrl && (sessionLoading || !hostToken))) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#06090e" }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
      </div>
    );
  }

  if (!hostToken || !browserHostUrl) {
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
            <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
            <CardTitle className="text-white">
              Сессия хоста не найдена
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center text-sm text-slate-400 space-y-3">
            <p>
              Перейди в дашборд хоста и нажми «Проверить самому» ещё раз — эта
              страница доступна только через кнопку тест-сессии.
            </p>
            <Link href="/host">
              <Button className="bg-sky-500 hover:bg-sky-400">
                Дашборд хоста
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const iframeSrc =
    import.meta.env.BASE_URL.replace(/\/$/, "") +
    "/" +
    browserHostUrl.replace(/^\//, "");

  return (
    <div
      className="min-h-screen text-slate-300 flex flex-col"
      style={{ background: "#06090e" }}
    >
      <header
        className="flex items-center justify-between px-6 py-3 border-b"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-3">
          <Gamepad2 className="h-5 w-5 text-sky-400" />
          <div className="font-bold text-white">
            {session?.appName || "Browser host"}
          </div>
          <Badge
            variant="outline"
            className="font-mono text-[10px]"
            style={{
              borderColor:
                connectionState === "connected" ? "#0ea5e9" : "rgba(255,255,255,0.1)",
              color: connectionState === "connected" ? "#38bdf8" : "#94a3b8",
            }}
          >
            {connectionState === "connected" ? (
              <Wifi className="h-3 w-3 mr-1 inline" />
            ) : (
              <WifiOff className="h-3 w-3 mr-1 inline" />
            )}
            {connectionState.toUpperCase()}
          </Badge>
        </div>
        <Button
          size="sm"
          onClick={handleEndSession}
          style={{ background: "rgba(239,68,68,0.85)", color: "#fff" }}
        >
          <PowerOff className="h-4 w-4 mr-1.5" />
          Завершить сессию
        </Button>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 p-4">
        <div
          className="rounded-lg overflow-hidden flex items-center justify-center"
          style={{
            background: "#000",
            border: "1px solid rgba(255,255,255,0.06)",
            minHeight: 480,
          }}
        >
          {isExternal ? (
            <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
              <Gamepad2 className="h-10 w-10 text-sky-400" />
              <p className="text-white font-semibold">
                Стрим произвольного сайта
              </p>
              <p className="text-sm text-slate-400 max-w-md">
                1. Открой{" "}
                <a
                  href={browserHostUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400 underline break-all"
                >
                  {browserHostUrl}
                </a>{" "}
                в новой вкладке.
                <br />
                2. Нажми «Поделиться вкладкой» и выбери её в диалоге браузера
                (отметь «Также делиться звуком вкладки», если нужен звук).
              </p>
              {connectionState === "new" || connectionState === "closed" ? (
                <Button
                  onClick={handleShareTab}
                  className="bg-sky-500 hover:bg-sky-400 text-white"
                  data-testid="button-share-tab"
                >
                  <Wifi className="h-4 w-4 mr-2" />
                  Поделиться вкладкой
                </Button>
              ) : (
                <Badge variant="outline" className="text-sky-300 border-sky-500/40">
                  {connectionState === "connected"
                    ? "Стрим идёт — игрок видит твою вкладку"
                    : "Ожидание подключения игрока…"}
                </Badge>
              )}
              <p className="text-xs text-slate-500 max-w-md">
                Управление работает через агент — мышь и клавиатура игрока
                управляют твоим экраном. Требуется запущенный Desktop Agent.
              </p>
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              src={iframeSrc}
              title="Browser-hosted game"
              className="w-full h-full"
              style={{ minHeight: 480, border: 0 }}
              onLoad={() => setIframeReady(true)}
            />
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <Card
            style={{
              background: "#0a1018",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-white">Ссылка для гостя</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div
                className="rounded-md p-2 font-mono text-[11px] break-all"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  color: "#cbd5e1",
                }}
              >
                {shareUrl || "—"}
              </div>
              <Button
                size="sm"
                className="w-full"
                onClick={() => {
                  if (!shareUrl) return;
                  navigator.clipboard
                    .writeText(shareUrl)
                    .then(() => toast.success("Скопировано"))
                    .catch(() => toast.error("Не удалось скопировать"));
                }}
                style={{ background: "#0ea5e9", color: "#fff" }}
              >
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                Скопировать
              </Button>
            </CardContent>
          </Card>

          <Card
            style={{
              background: "#0a1018",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-white">Состояние</CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-2 text-slate-400">
              {isExternal ? (
                <div className="flex justify-between">
                  <span>Вкладка захвачена</span>
                  <span className={tabCaptured ? "text-emerald-400" : "text-slate-500"}>
                    {tabCaptured ? "да" : "нет"}
                  </span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span>Игра загружена</span>
                    <span className={iframeReady ? "text-emerald-400" : "text-slate-500"}>
                      {iframeReady ? "да" : "нет"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Canvas найден</span>
                    <span className={canvasFound ? "text-emerald-400" : "text-slate-500"}>
                      {canvasFound ? "да" : "нет"}
                    </span>
                  </div>
                </>
              )}
              <div className="flex justify-between">
                <span>Гость</span>
                <span
                  className={
                    connectionState === "connected"
                      ? "text-emerald-400"
                      : "text-slate-500"
                  }
                >
                  {connectionState === "connected"
                    ? "подключён"
                    : connectionState}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Статус сессии</span>
                <span className="text-slate-300">
                  {session?.status ?? "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Аудио</span>
                <span className={audioCaptured ? "text-emerald-400" : "text-slate-500"}>
                  {audioCaptured ? "захвачено" : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Ставка</span>
                <span className="text-slate-300">
                  ${session?.ratePerMinute?.toFixed(2) ?? "—"}/мин
                </span>
              </div>
            </CardContent>
          </Card>

          <Card
            style={{
              background: "#0a1018",
              border: "1px solid rgba(16,185,129,0.25)",
            }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-white">Заработок</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="text-2xl font-extrabold font-mono text-emerald-300 tabular-nums"
                data-testid="text-host-earnings-lzt"
              >
                {earnedLzt.toLocaleString("ru-RU")} LZT
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                ≈ ${(earnedLzt / 200).toFixed(2)} · обновление каждую секунду
              </div>
            </CardContent>
          </Card>

          {!canvasFound && (
            <div
              className="flex items-center gap-2 text-xs text-slate-400 px-3 py-2 rounded"
              style={{
                background: "rgba(14,165,233,0.08)",
                border: "1px solid rgba(14,165,233,0.18)",
              }}
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400" />
              Ждём, пока игра нарисует canvas…
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
