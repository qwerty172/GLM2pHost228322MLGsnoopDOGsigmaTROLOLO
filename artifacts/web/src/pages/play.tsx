import { useCallback, useEffect, useRef, useState } from "react";
import { useRoute, Link, useSearch } from "wouter";
import {
  useGetSessionByPlayerToken,
  getGetSessionByPlayerTokenQueryKey,
  useClaimSession,
  useGetWallet,
  getGetWalletQueryKey,
  getSessionByInvite,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gamepad2, AlertCircle, Loader2, Wifi, WifiOff, VolumeX, Clock, TrendingDown, Activity, RefreshCw, Clapperboard, Settings2, X, Layers, ExternalLink, FlaskConical } from "lucide-react";
import { WebGLVideoShader, SHADER_PRESETS, type PresetKey } from "@/components/webgl-video-shader";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { TouchOverlay } from "@/components/TouchOverlay";
import { KeyboardOverlay } from "@/components/KeyboardOverlay";
import { toast } from "sonner";
import { usePlayerWallet } from "@/hooks/use-player-wallet";
import { getIceConnectionLabel } from "@/lib/connection-hints";

const LZT_PER_USDT = 200;
type PaymentSource = "auto" | "blue" | "green";

const isDev = import.meta.env.DEV;
const devLog = (...args: unknown[]) => {
  if (isDev) console.log(...args);
};
const devWarn = (...args: unknown[]) => {
  if (isDev) console.warn(...args);
};

function mapClaimError(err: unknown): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : typeof err === "object" && err && "message" in err
          ? String((err as { message: unknown }).message)
          : "";
  const lower = raw.toLowerCase();
  if (/insufficient|balance|недостаточно|exhausted/i.test(raw) || lower.includes("balance")) {
    return "Недостаточно средств на кошельке. Пополни баланс и попробуй снова.";
  }
  if (/already.?claimed|уже занят|claimed/i.test(raw)) {
    return "Сессия уже занята другим игроком.";
  }
  if (/host.?offline|host_offline|хост оффлайн/i.test(raw)) {
    return "Хост сейчас офлайн. Выбери другого или попробуй позже.";
  }
  if (/not.?found|404|не найден/i.test(raw)) {
    return "Сессия не найдена или уже завершена.";
  }
  if (/rate.?limit|too many/i.test(raw)) {
    return "Слишком много попыток. Подожди немного и попробуй снова.";
  }
  if (raw.trim()) return raw;
  return "Не удалось занять сессию. Попробуй ещё раз.";
}

// ---------------------------------------------------------------------------
// IframeTestSession — renders a browser-hosted game URL inside an iframe.
// Shows a warning banner if the site blocks framing (X-Frame-Options / CSP),
// and always exposes an "Open in new tab" button as a fallback.
// ---------------------------------------------------------------------------
function IframeTestSession({ iframeUrl, gameTitle }: { iframeUrl: string; gameTitle: string }) {
  const [blocked, setBlocked] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Heuristic: if the iframe hasn't received a load event within 6 s, the
  // page is likely being blocked by X-Frame-Options / CSP frame-ancestors.
  // We can't read the actual error (cross-origin), so the timer is the best
  // signal available in a browser sandbox.
  useEffect(() => {
    let loaded = false;
    const timer = setTimeout(() => {
      if (!loaded) setBlocked(true);
    }, 6000);
    const el = iframeRef.current;
    const onLoad = () => {
      loaded = true;
      clearTimeout(timer);
      setBlocked(false);
    };
    el?.addEventListener("load", onLoad);
    return () => {
      clearTimeout(timer);
      el?.removeEventListener("load", onLoad);
    };
  }, [iframeUrl]);

  return (
    <div className="min-h-screen bg-black flex flex-col relative overflow-hidden">
      {/* Top bar */}
      <div className="absolute top-3 left-0 right-0 z-20 flex justify-center pointer-events-none">
        <div
          className="flex items-center gap-3 px-4 py-2 rounded-full pointer-events-auto"
          style={{ background: "rgba(10,16,24,0.85)", border: "1px solid rgba(139,92,246,0.4)", backdropFilter: "blur(8px)" }}
        >
          <FlaskConical className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-violet-300 text-xs font-semibold tracking-wide">ТЕСТ-СЕССИЯ</span>
          <span className="text-slate-500 text-xs">{gameTitle}</span>
          <span className="text-violet-400 text-xs">· бесплатно</span>
          <a
            href={iframeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 ml-1"
          >
            <ExternalLink className="w-3 h-3" />
            Открыть в новой вкладке
          </a>
        </div>
      </div>

      {/* Blocked-by-X-Frame-Options warning */}
      {blocked && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/90 text-center px-6">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 max-w-md space-y-3">
            <p className="text-amber-300 font-semibold text-base">Игра не открывается во встроенном окне</p>
            <p className="text-slate-400 text-sm">
              Эта игра запрещает запуск внутри другого сайта. Это ограничение самой игры — обойти его невозможно.
            </p>
            <p className="text-slate-400 text-sm">
              Попробуй открыть игру напрямую в новой вкладке или выбери другую игру из каталога.
            </p>
            <a
              href={iframeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium px-4 py-2"
            >
              <ExternalLink className="w-4 h-4" />
              Открыть {iframeUrl} в новой вкладке
            </a>
          </div>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={iframeUrl}
        className="flex-1 w-full border-0"
        style={{ minHeight: "100vh" }}
        allow="autoplay; fullscreen; keyboard-map"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation"
        referrerPolicy="no-referrer"
        title={`Тест: ${gameTitle}`}
      />
    </div>
  );
}

export default function Play() {
  const [isInviteRoute, inviteParams] = useRoute("/play/i/:inviteCode");
  const [, tokenParams] = useRoute("/play/:playerToken");
  const inviteCode = isInviteRoute ? (inviteParams?.inviteCode ?? "") : "";
  const [resolvedToken, setResolvedToken] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(!!inviteCode);

  // Resolve invite → playerToken in-place (no separate spinner page).
  useEffect(() => {
    if (!inviteCode) {
      setInviteLoading(false);
      return;
    }
    let cancelled = false;
    setInviteLoading(true);
    setInviteError(null);
    void (async () => {
      try {
        const data = await getSessionByInvite(inviteCode);
        if (cancelled) return;
        if (!data.playerToken) {
          setInviteError("В ответе нет токена игрока — приглашение повреждено");
          setInviteLoading(false);
          return;
        }
        setResolvedToken(data.playerToken);
        setInviteLoading(false);
      } catch (err) {
        if (cancelled) return;
        const apiErr = err as { status?: number; data?: { error?: string; message?: string } };
        setInviteError(
          apiErr.data?.message ||
            (apiErr.data?.error === "invite_expired"
              ? "Ссылка-приглашение истекла"
              : apiErr.status === 404
                ? "Приглашение не найдено"
                : "Ошибка сети"),
        );
        setInviteLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inviteCode]);

  const playerToken = inviteCode
    ? resolvedToken
    : (tokenParams?.playerToken || "");
  const search$ = useSearch();
  const blockMinutesParam = (() => {
    const sp = new URLSearchParams(search$);
    const v = Number(sp.get("block"));
    return v === 10 || v === 15 || v === 25 ? v : undefined;
  })();

  const { data: session, isLoading, isError } = useGetSessionByPlayerToken(playerToken, {
    query: {
      enabled: !!playerToken,
      queryKey: getGetSessionByPlayerTokenQueryKey(playerToken),
      refetchInterval: 20_000,
    }
  });

  // Detect test sessions with a browser-hosted game early so all effects can
  // skip WebRTC / billing logic before the early-return iframe branch fires.
  const isTestBrowserSession = !!(
    (session as any)?.isTest && (session as any)?.gameBrowserHostUrl
  );

  const { playerWalletToken, registerGuest } = usePlayerWallet();

  // Auto-register a guest account when a user lands directly on /play without a wallet.
  useEffect(() => {
    if (!playerWalletToken) {
      void registerGuest();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);

  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>("new");
  const [isPlaying, setIsPlaying] = useState(false);
  const [showAudioPrompt, setShowAudioPrompt] = useState(false);
  const [iceType, setIceType] = useState<"relay" | "srflx" | "host" | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [e2eRtt, setE2eRtt] = useState<number | null>(null);
  const [dataChannelOpen, setDataChannelOpen] = useState(false);
  const [isSavingClip, setIsSavingClip] = useState(false);
  const [showClipSettings, setShowClipSettings] = useState(false);

  // Shader / post-processing state
  const [showShaderPanel, setShowShaderPanel] = useState(false);
  const [activePreset, setActivePreset] = useState<PresetKey>(
    () => (localStorage.getItem("shaderPreset") as PresetKey | null) ?? "upscale",
  );
  const [customShaderCode, setCustomShaderCode] = useState(
    () => localStorage.getItem("shaderCustomCode") ?? SHADER_PRESETS.sharpen.code,
  );
  const [shaderCompileError, setShaderCompileError] = useState<string | null>(null);
  const shaderActive = activePreset !== "none";
  const activeFrag =
    activePreset === "custom" ? customShaderCode : SHADER_PRESETS[activePreset as Exclude<PresetKey, "custom">]?.code ?? SHADER_PRESETS.none.code;

  // Stream quality settings — adaptive bitrate is on by default so newcomers
  // get a smooth stream without touching anything.
  const [adaptiveBitrate, setAdaptiveBitrate] = useState<boolean>(
    () => localStorage.getItem("adaptiveBitrate") !== "off",
  );
  const [manualBitrateKbps, setManualBitrateKbps] = useState<number>(
    () => Number(localStorage.getItem("manualBitrateKbps")) || 6000,
  );
  const [fpsCapHint, setFpsCapHint] = useState<number>(
    () => Number(localStorage.getItem("fpsCapHint")) || 60,
  );
  const [showStatsOverlay, setShowStatsOverlay] = useState<boolean>(
    () => localStorage.getItem("showStatsOverlay") === "on",
  );
  const [liveStats, setLiveStats] = useState<{ kbps: number; fps: number; lossPct: number } | null>(null);
  const currentBitrateKbpsRef = useRef<number>(6000);
  const lastStatsSampleRef = useRef<{ bytes: number; ts: number } | null>(null);

  // Virtual gamepad overlay — auto-enabled on touch devices
  const [gamepadOverlay, setGamepadOverlay] = useState<boolean>(
    () => navigator.maxTouchPoints > 0,
  );
  // Layout edit mode: lets players drag-to-reposition each control
  const [gamepadEditMode, setGamepadEditMode] = useState(false);

  // Keyboard key overlay — auto-enabled on touch devices
  const [keyboardOverlay, setKeyboardOverlay] = useState(false);
  const [keyboardEditMode, setKeyboardEditMode] = useState(false);

  // Live HUD: client-side ticking balance estimate between API syncs
  const [estimatedBalanceLzt, setEstimatedBalanceLzt] = useState<number | null>(null);
  const ratePerSecLztRef = useRef<number>(0);
  const sessionEndReasonRef = useRef<string | null>(null);

  // Block-time billing state
  const [blockMinsLeft, setBlockMinsLeft] = useState<number | null>(null);
  const [renewBlockLoading, setRenewBlockLoading] = useState(false);
  const blockWarningShownRef = useRef(false);
  /** Нижняя панель — без полноэкранных оверлеев, игра остаётся кликабельной. */
  type PlayDock = "none" | "block_hint" | "block_end" | "rating" | "host_offline" | "balance" | "disconnect";
  const [playDock, setPlayDock] = useState<PlayDock>("none");
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const ratingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const startedRef = useRef(false);

  // Reconnect state
  const iceRestartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longDisconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rttSamplesRef = useRef<number[]>([]);
  const wsReconnectDelayRef = useRef<number>(1000);
  const wsReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsUrlRef = useRef<string>("");

  // Clip recording ring-buffer
  const clipChunksRef = useRef<Blob[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const clipRafRef = useRef<number>(0);
  const clipCanvasRef = useRef<HTMLCanvasElement | null>(null);

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

  // Tick balance estimate every 5s (was 1s — лишние ре-рендеры)
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      setEstimatedBalanceLzt((prev) => {
        if (prev === null) return prev;
        return Math.max(0, prev - ratePerSecLztRef.current * 5);
      });
    }, 5000);
    return () => clearInterval(id);
  }, [isPlaying]);

  // Подсказки по завершению сессии — только нижняя панель, без блокирующих модалок
  useEffect(() => {
    if (!session) return;
    const reason = (session as typeof session & { endReason?: string | null }).endReason ?? null;
    sessionEndReasonRef.current = reason;

    if (session.status === "ended" && isPlaying) {
      if (reason === "host_offline") {
        toast.error("Хост отключился");
        setPlayDock("host_offline");
      } else if (reason === "balance_exhausted") {
        toast.error("Баланс исчерпан");
        setPlayDock("balance");
      } else if (reason === "block_expired") {
        setPlayDock("block_end");
      }
    }

    if (session.status === "ended" && hasClaimed && !ratingSubmitted && reason !== "host_offline") {
      if (ratingTimerRef.current) clearTimeout(ratingTimerRef.current);
      ratingTimerRef.current = setTimeout(() => {
        setPlayDock((d) => (d === "none" ? "rating" : d));
      }, 5000);
    }

    return () => {
      if (ratingTimerRef.current) {
        clearTimeout(ratingTimerRef.current);
        ratingTimerRef.current = null;
      }
    };
  }, [session?.status, (session as typeof session & { endReason?: string | null })?.endReason, isPlaying, ratingSubmitted, hasClaimed]);

  // Initialize block countdown from session data when session loads
  useEffect(() => {
    if (!session || !isPlaying) return;
    const s = session as typeof session & { blockMinutes?: number | null };
    if (!s.blockMinutes) return;
    if (blockMinsLeft === null) {
      setBlockMinsLeft(s.blockMinutes);
    }
  }, [session?.id, isPlaying]);

  // Client-side block countdown: ticks every minute in sync with billing
  useEffect(() => {
    if (blockMinsLeft === null || !isPlaying) return;
    if (blockMinsLeft <= 0) return;
    const id = setInterval(() => {
      setBlockMinsLeft((prev) => {
        if (prev === null || prev <= 1) return 0;
        return prev - 1;
      });
    }, 60_000);
    return () => clearInterval(id);
  }, [blockMinsLeft === null, isPlaying]);

  // Низкий остаток блока — компактная панель снизу (не перекрывает экран)
  useEffect(() => {
    if (!isPlaying || session?.status === "ended") return;
    if (blockMinsLeft !== null && blockMinsLeft <= 5 && blockMinsLeft > 0) {
      setPlayDock((d) => (d === "none" || d === "block_hint" ? "block_hint" : d));
    } else if (blockMinsLeft !== null && blockMinsLeft > 5) {
      setPlayDock((d) => (d === "block_hint" ? "none" : d));
    }
  }, [blockMinsLeft, isPlaying, session?.status]);

  const cleanupConnection = useCallback(() => {
    if (iceRestartTimerRef.current) { clearTimeout(iceRestartTimerRef.current); iceRestartTimerRef.current = null; }
    if (longDisconnectTimerRef.current) { clearTimeout(longDisconnectTimerRef.current); longDisconnectTimerRef.current = null; }
    if (pingIntervalRef.current) { clearInterval(pingIntervalRef.current); pingIntervalRef.current = null; }
    if (wsReconnectTimerRef.current) { clearTimeout(wsReconnectTimerRef.current); wsReconnectTimerRef.current = null; }
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
    // Stop clip recording
    if (clipRafRef.current) { cancelAnimationFrame(clipRafRef.current); clipRafRef.current = 0; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
    }
    mediaRecorderRef.current = null;
    clipChunksRef.current = [];
    clipCanvasRef.current = null;
    startedRef.current = false;
    rttSamplesRef.current = [];
    setIsPlaying(false);
    setConnectionState("closed");
    setReconnecting(false);
    setPlayDock((d) => (d === "disconnect" ? "none" : d));
    setE2eRtt(null);
    setDataChannelOpen(false);
  }, []);

  // Set up the DataChannel with ping/pong E2E RTT measurement.
  const setupDataChannel = useCallback((dc: RTCDataChannel) => {
    dcRef.current = dc;

    dc.onopen = () => {
      setDataChannelOpen(true);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = setInterval(() => {
        if (dc.readyState === "open") {
          dc.send(JSON.stringify({ type: "dc-ping", t: Date.now() }));
        }
      }, 2000);
    };

    dc.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string) as Record<string, unknown>;
        if (msg["type"] === "dc-pong" && typeof msg["t"] === "number") {
          const rtt = Date.now() - (msg["t"] as number);
          const samples = [...rttSamplesRef.current.slice(-4), rtt];
          rttSamplesRef.current = samples;
          const avg = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
          setE2eRtt(avg);
        }
      } catch {
        // ignore parse errors — also handles regular input echo or other DC messages
      }
    };

    dc.onclose = () => {
      if (pingIntervalRef.current) { clearInterval(pingIntervalRef.current); pingIntervalRef.current = null; }
      setE2eRtt(null);
      setDataChannelOpen(false);
    };
  }, []);

  // Initialize the canvas-compositing clip recorder once we have a remote video stream.
  // We draw each frame onto an offscreen canvas with a watermark, then record the canvas
  // stream so the watermark is baked into the downloaded WebM.
  const initClipRecorder = useCallback(() => {
    if (clipRafRef.current) { cancelAnimationFrame(clipRafRef.current); clipRafRef.current = 0; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
    }
    clipChunksRef.current = [];

    const videoEl = videoRef.current;
    if (!videoEl) return;

    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    clipCanvasRef.current = canvas;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const drawFrame = () => {
      if (!videoRef.current) return;
      const vw = videoRef.current.videoWidth;
      const vh = videoRef.current.videoHeight;
      if (vw > 0 && vh > 0 && (canvas.width !== vw || canvas.height !== vh)) {
        canvas.width = vw;
        canvas.height = vh;
      }
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      // Watermark: platform name bottom-right
      const wmText = "DecentralHub";
      const fontSize = Math.max(14, Math.round(canvas.width * 0.016));
      ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.shadowColor = "rgba(0,0,0,0.9)";
      ctx.shadowBlur = 8;
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.fillText(wmText, canvas.width - 14, canvas.height - 12);
      ctx.shadowBlur = 0;
      clipRafRef.current = requestAnimationFrame(drawFrame);
    };
    drawFrame();

    const captureStream = canvas.captureStream(30);
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";

    try {
      const recorder = new MediaRecorder(captureStream, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          clipChunksRef.current.push(e.data);
          // Ring buffer: keep last 32 chunks ≈ 30 s
          if (clipChunksRef.current.length > 32) clipChunksRef.current.shift();
        }
      };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      devLog("[clip] Recorder started, mimeType:", mimeType);
    } catch (err) {
      devWarn("[clip] MediaRecorder init failed:", err);
    }
  }, []);

  // Upload clip blob to the platform's built-in storage or a custom S3 endpoint.
  const uploadClipToCloud = useCallback(async (blob: Blob, filename: string) => {
    // Platform storage (requires player auth)
    if (playerWalletToken) {
      try {
        const formData = new FormData();
        formData.append("file", blob, filename);
        const res = await fetch(`${import.meta.env.BASE_URL}api/storage/clip-upload`, {
          method: "POST",
          headers: { "x-player-wallet-token": playerWalletToken },
          body: formData,
        });
        if (res.ok) {
          devLog("[clip] Uploaded to platform storage");
          return;
        }
      } catch {
        // Platform storage unavailable, fall through to custom S3
      }
    }

    // Custom S3: user supplies a PUT URL template in localStorage.
    // The template may include {filename} which is replaced with the actual filename.
    const s3Endpoint = localStorage.getItem("clipS3Endpoint");
    if (!s3Endpoint) return;

    try {
      const uploadUrl = s3Endpoint.replace("{filename}", encodeURIComponent(filename));
      const headers: Record<string, string> = { "Content-Type": "video/webm" };
      const s3Key = localStorage.getItem("clipS3Key");
      if (s3Key) headers["x-api-key"] = s3Key;
      await fetch(uploadUrl, { method: "PUT", headers, body: blob });
      devLog("[clip] Uploaded to custom S3:", uploadUrl);
    } catch (err) {
      devWarn("[clip] Custom S3 upload failed:", err);
    }
  }, [playerWalletToken]);

  // Save the last ≤30 s of recorded video as a WebM file, with watermark baked in.
  const saveClip = useCallback(async () => {
    const chunks = [...clipChunksRef.current];
    if (chunks.length === 0) {
      toast.error("Буфер клипа пуст — дождись начала игры");
      return;
    }
    setIsSavingClip(true);
    try {
      const blob = new Blob(chunks, { type: "video/webm" });
      const gameTitle = (session as typeof session & { gameTitle?: string | null })?.gameTitle || session?.appName || "game";
      const safeGame = gameTitle.replace(/[^a-z0-9]/gi, "-").toLowerCase().slice(0, 40);
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const filename = `clip-${safeGame}-${ts}.webm`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      // Fire-and-forget cloud upload (silently ignored on failure)
      void uploadClipToCloud(blob, filename);

      toast.success(`Клип сохранён (${Math.round(blob.size / 1024)} KB)`);
    } catch (err) {
      if (isDev) console.error("[clip] Save failed:", err);
      toast.error("Не удалось сохранить клип");
    } finally {
      setIsSavingClip(false);
    }
  }, [session, uploadClipToCloud]);

  // Trigger ICE restart: send a new offer with iceRestart flag through the signaling WS.
  const triggerIceRestart = useCallback(async (pc: RTCPeerConnection) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      pc.restartIce();
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      ws.send(JSON.stringify({ type: "offer", sdp: { type: offer.type, sdp: offer.sdp } }));
      devLog("[ice-restart] Sent re-offer to host");
    } catch (err) {
      devWarn("[ice-restart] Failed to create re-offer:", err);
    }
  }, []);

  // Build and connect a WebSocket with exponential-backoff reconnect.
  // Also handles all signaling messages for offer/answer/ICE for the lifetime of `pc`.
  const connectWs = useCallback((url: string, pc: RTCPeerConnection) => {
    if (!startedRef.current) return;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      wsReconnectDelayRef.current = 1000;
      // Create the DataChannel only on the first open (it lives on the PC, not the WS).
      if (!dcRef.current || dcRef.current.readyState === "closed") {
        setupDataChannel(pc.createDataChannel("input"));
      }
      // If ICE was suspended during a WS drop, trigger restart now.
      const ice = pc.iceConnectionState;
      if (ice === "disconnected" || ice === "failed") {
        void triggerIceRestart(pc);
      }
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data as string) as Record<string, unknown>;
        const type = msg["type"] as string;

        if (type === "offer") {
          // Offer from host (initial or ICE-restart re-offer).
          await pc.setRemoteDescription(new RTCSessionDescription(msg["sdp"] as RTCSessionDescriptionInit));

          // Force H.264 on the answer.
          const transceivers = pc.getTransceivers();
          for (const transceiver of transceivers) {
            if (transceiver.receiver.track.kind === "video") {
              const capabilities = RTCRtpReceiver.getCapabilities("video");
              if (capabilities) {
                const h264 = capabilities.codecs.filter(
                  (c) => c.mimeType.toLowerCase() === "video/h264",
                );
                if (h264.length > 0) {
                  try { transceiver.setCodecPreferences(h264); } catch { /* unsupported */ }
                }
              }
            }
          }

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          ws.send(JSON.stringify({ type: "answer", sdp: answer }));
        } else if (type === "answer") {
          // Answer from host in response to our ICE-restart re-offer.
          await pc.setRemoteDescription(new RTCSessionDescription(msg["sdp"] as RTCSessionDescriptionInit));
        } else if (type === "ice-candidate") {
          await pc.addIceCandidate(new RTCIceCandidate(msg["candidate"] as RTCIceCandidateInit));
        } else if (type === "control" && msg["action"] === "reject") {
          const reason: string = (msg["reason"] as string) ?? "unknown";
          const msgText =
            reason === "host_busy"
              ? "Хост сейчас занят с другим игроком. Попробуй позже."
              : reason === "game_unavailable"
                ? "Игра временно недоступна на этом хосте."
                : `Хост отклонил соединение (${reason}).`;
          toast.error(msgText);
          cleanupConnection();
        } else if (type === "block-warning") {
          const minsLeft = (msg["minsLeft"] as number) ?? 2;
          setBlockMinsLeft(minsLeft);
          if (!blockWarningShownRef.current) {
            blockWarningShownRef.current = true;
            toast.warning(`Осталось ${minsLeft} мин блока — сессия скоро завершится.`, { duration: 6000 });
          }
        } else if (type === "block-expired") {
          setBlockMinsLeft(0);
          toast.info("Время блока закончилось");
          // Полноэкранную панель покажем когда API подтвердит status=ended
        } else if (type === "block-renewed") {
          const total = (msg["blockMinutes"] as number) ?? null;
          const added = (msg["addedMinutes"] as number) ?? 0;
          if (total != null) setBlockMinsLeft(total);
          blockWarningShownRef.current = false;
          setPlayDock("none");
          toast.success(`Блок продлён на ${added} мин`);
        }
      } catch (err) {
        if (isDev) console.error("Error handling WS message", err);
      }
    };

    ws.onerror = () => {
      // close event will follow; handled there.
    };

    ws.onclose = () => {
      if (!startedRef.current) return;
      // Exponential backoff: 1s → 2s → 4s → 8s (cap).
      const delay = wsReconnectDelayRef.current;
      wsReconnectDelayRef.current = Math.min(delay * 2, 8000);
      devLog(`[ws] Disconnected — reconnecting in ${delay}ms`);
      wsReconnectTimerRef.current = setTimeout(() => {
        connectWs(url, pc);
      }, delay);
    };
  }, [cleanupConnection, setupDataChannel, triggerIceRestart]);

  const startConnection = useCallback(async () => {
    // Wallet must be ready before we latch startedRef — otherwise a missing
    // token permanently blocks WebRTC for this page load.
    if (!playerToken || !playerWalletToken || startedRef.current) return;
    startedRef.current = true;

    setIsPlaying(true);
    setConnectionState("connecting");

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";

    // Prefer a short-lived WS ticket so long-lived tokens never appear in URLs
    // (server logs, browser history, referrer headers). Falls back to the
    // legacy query-string path when JWT auth is not yet configured on the server.
    let wsUrl: string;
    const wsSessionId = session?.id;
    if (wsSessionId) {
      try {
        const ticketRes = await fetch(`${import.meta.env.BASE_URL}api/auth/ws-ticket`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-player-wallet-token": playerWalletToken,
          },
          body: JSON.stringify({ role: "player", sessionId: wsSessionId }),
        });
        if (ticketRes.ok) {
          const { wsTicket } = await ticketRes.json() as { wsTicket: string };
          wsUrl = `${wsProtocol}//${window.location.host}${import.meta.env.BASE_URL}api/signal?role=player&wsTicket=${encodeURIComponent(wsTicket)}&sessionId=${encodeURIComponent(wsSessionId)}`;
        } else {
          // JWT not configured on server — fall back to legacy token path.
          wsUrl = `${wsProtocol}//${window.location.host}${import.meta.env.BASE_URL}api/signal?role=player&playerToken=${encodeURIComponent(playerToken)}&playerWalletToken=${encodeURIComponent(playerWalletToken)}`;
        }
      } catch {
        wsUrl = `${wsProtocol}//${window.location.host}${import.meta.env.BASE_URL}api/signal?role=player&playerToken=${encodeURIComponent(playerToken)}&playerWalletToken=${encodeURIComponent(playerWalletToken)}`;
      }
    } else {
      wsUrl = `${wsProtocol}//${window.location.host}${import.meta.env.BASE_URL}api/signal?role=player&playerToken=${encodeURIComponent(playerToken)}&playerWalletToken=${encodeURIComponent(playerWalletToken)}`;
    }
    wsUrlRef.current = wsUrl;

    // Fetch ICE server config (STUN + optional TURN) from the API.
    let iceServers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
    try {
      const cfgRes = await fetch(`${import.meta.env.BASE_URL}api/public/ice-config`);
      if (cfgRes.ok) {
        const cfgJson = (await cfgRes.json()) as { iceServers: RTCIceServer[] };
        if (Array.isArray(cfgJson.iceServers) && cfgJson.iceServers.length > 0) {
          iceServers = cfgJson.iceServers;
        }
      }
    } catch {
      devWarn("[ice] Failed to fetch ICE config, using default STUN only");
    }

    const pc = new RTCPeerConnection({ iceServers });
    pcRef.current = pc;

    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
      if (pc.connectionState === "connected") {
        // Cleared reconnecting state on successful reconnect.
        setReconnecting(false);
        if (longDisconnectTimerRef.current) { clearTimeout(longDisconnectTimerRef.current); longDisconnectTimerRef.current = null; }
        // Log the ICE candidate type for diagnostics.
        void pc.getStats().then((stats) => {
          stats.forEach((report) => {
            if (report.type === "candidate-pair" && report.state === "succeeded") {
              const localId: string = report.localCandidateId as string;
              stats.forEach((r) => {
                if (r.id === localId && r.type === "local-candidate") {
                  const t = r.candidateType as string;
                  const mapped = t === "relay" ? "relay" : t === "srflx" ? "srflx" : "host";
                  devLog(`[ice] connection type: ${mapped}`);
                  setIceType(mapped as "relay" | "srflx" | "host");
                }
              });
            }
          });
        });
      } else if (pc.connectionState === "closed") {
        cleanupConnection();
      }
    };

    // ICE-level disconnect handling: wait 3s then attempt restart.
    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      devLog(`[ice] iceConnectionState: ${state}`);

      if (state === "disconnected") {
        setReconnecting(true);
        if (iceRestartTimerRef.current) clearTimeout(iceRestartTimerRef.current);
        iceRestartTimerRef.current = setTimeout(() => {
          if (pcRef.current?.iceConnectionState === "disconnected") {
            void triggerIceRestart(pcRef.current);
          }
        }, 3000);

        // Show "Переподключиться" modal after 30 seconds of no recovery.
        if (longDisconnectTimerRef.current) clearTimeout(longDisconnectTimerRef.current);
        longDisconnectTimerRef.current = setTimeout(() => {
          setPlayDock((d) => (d === "none" || d === "block_hint" ? "disconnect" : d));
        }, 30000);
      } else if (state === "failed") {
        // Immediate restart attempt on failed (more severe than disconnected).
        setReconnecting(true);
        if (iceRestartTimerRef.current) clearTimeout(iceRestartTimerRef.current);
        void triggerIceRestart(pc);

        if (longDisconnectTimerRef.current) clearTimeout(longDisconnectTimerRef.current);
        longDisconnectTimerRef.current = setTimeout(() => {
          setPlayDock((d) => (d === "none" || d === "block_hint" ? "disconnect" : d));
        }, 30000);
      } else if (state === "connected" || state === "completed") {
        // Clear reconnect state on recovery.
        if (iceRestartTimerRef.current) { clearTimeout(iceRestartTimerRef.current); iceRestartTimerRef.current = null; }
        if (longDisconnectTimerRef.current) { clearTimeout(longDisconnectTimerRef.current); longDisconnectTimerRef.current = null; }
        setReconnecting(false);
        setPlayDock((d) => (d === "disconnect" ? "none" : d));
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ice-candidate", candidate: event.candidate }));
      }
    };

    pc.ontrack = (event) => {
      if (videoRef.current && event.streams[0]) {
        videoRef.current.srcObject = event.streams[0];
        videoRef.current.play().catch(() => {
          setShowAudioPrompt(true);
        });
        // Start clip ring-buffer recorder with canvas watermarking
        // Small delay so the video element has time to attach the stream
        setTimeout(() => initClipRecorder(), 500);
      }
    };

    connectWs(wsUrl, pc);
  }, [session?.id, playerToken, playerWalletToken, cleanupConnection, connectWs, triggerIceRestart, initClipRecorder]);

  useEffect(() => {
    if (
      !session ||
      session.status === "ended" ||
      !playerWalletToken ||
      hasClaimed ||
      claimSession.isPending ||
      isTestBrowserSession
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
        data: { playerWalletToken, paymentSource, ...(blockMinutesParam ? { blockMinutes: blockMinutesParam } : {}) },
      },
      {
        onSuccess: () => {
          setHasClaimed(true);
          setClaimError(null);
        },
        onError: (err: unknown) => {
          setClaimError(mapClaimError(err));
          setShowPaymentOptions(true);
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
      playerWalletToken &&
      !startedRef.current &&
      !isTestBrowserSession
    ) {
      void startConnection();
    }
    return () => {
      cleanupConnection();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, hasClaimed, isTestBrowserSession, playerWalletToken]);

  const handleEnableAudio = () => {
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.play().then(() => {
        setShowAudioPrompt(false);
      }).catch(() => {
        /* autoplay still blocked */
      });
    }
  };

  const renewBlock = useCallback(
    async (minutes: 10 | 15 | 25) => {
      if (!playerToken || !playerWalletToken || renewBlockLoading) return;
      setRenewBlockLoading(true);
      try {
        const res = await fetch(
          `${import.meta.env.BASE_URL}api/sessions/by-player-token/${encodeURIComponent(playerToken)}/renew-block`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ playerWalletToken, blockMinutes: minutes }),
          },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(data.error || "Не удалось продлить блок");
          return;
        }
        const bm = data.blockMinutes as number | undefined;
        if (bm != null) setBlockMinsLeft(bm);
        setPlayDock("none");
        blockWarningShownRef.current = false;
        toast.success(`Блок продлён на ${minutes} мин`);
      } catch {
        toast.error("Ошибка сети");
      } finally {
        setRenewBlockLoading(false);
      }
    },
    [playerToken, playerWalletToken, renewBlockLoading],
  );

  const submitRating = useCallback(async () => {
    if (!session?.id || !playerWalletToken || ratingSubmitted) return;
    try {
      const res = await fetch(
        `${import.meta.env.BASE_URL}api/sessions/${session.id}/rate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerWalletToken,
            score: ratingScore,
          }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.error !== "already_rated") {
          toast.error("Не удалось отправить оценку");
          return;
        }
      }
      setRatingSubmitted(true);
      setPlayDock((d) => (d === "rating" ? "none" : d));
      toast.success("Спасибо за оценку!");
    } catch {
      toast.error("Ошибка сети");
    }
  }, [session?.id, playerWalletToken, ratingScore, ratingSubmitted]);

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

  const sendGamepadInput = useCallback((axes: number[], buttons: number[]) => {
    const dc = dcRef.current;
    if (dc && dc.readyState === "open") {
      dc.send(JSON.stringify({ type: "gamepad", axes, buttons }));
    }
  }, []);

  const sendKeyboardInput = useCallback((key: string, code: string, action: "down" | "up") => {
    const dc = dcRef.current;
    if (dc && dc.readyState === "open") {
      dc.send(JSON.stringify({ type: "input", kind: "key", action, key, code }));
    }
  }, []);

  // Send a live FPS cap hint to the host whenever it changes.
  useEffect(() => {
    localStorage.setItem("fpsCapHint", String(fpsCapHint));
    const dc = dcRef.current;
    if (isPlaying && dc && dc.readyState === "open") {
      dc.send(JSON.stringify({ type: "set-fps", fps: fpsCapHint }));
    }
  }, [fpsCapHint, isPlaying, dataChannelOpen]);

  // Manual bitrate: applied immediately whenever adaptive mode is off.
  useEffect(() => {
    localStorage.setItem("manualBitrateKbps", String(manualBitrateKbps));
    localStorage.setItem("adaptiveBitrate", adaptiveBitrate ? "on" : "off");
    if (adaptiveBitrate) return;
    const dc = dcRef.current;
    if (isPlaying && dc && dc.readyState === "open") {
      currentBitrateKbpsRef.current = manualBitrateKbps;
      dc.send(JSON.stringify({ type: "set-bitrate", kbps: manualBitrateKbps }));
    }
  }, [manualBitrateKbps, adaptiveBitrate, isPlaying, dataChannelOpen]);

  // Adaptive bitrate: sample inbound-rtp video stats every 3s and nudge the
  // host's encoder bitrate up/down based on packet loss + free bandwidth.
  useEffect(() => {
    if (!isPlaying) return;
    localStorage.setItem("showStatsOverlay", showStatsOverlay ? "on" : "off");
    const id = setInterval(async () => {
      const pc = pcRef.current;
      const dc = dcRef.current;
      if (!pc) return;
      try {
        const stats = await pc.getStats();
        let bytesReceived = 0;
        let packetsLost = 0;
        let packetsReceived = 0;
        let framesPerSecond = 0;
        stats.forEach((r) => {
          if (r.type === "inbound-rtp" && (r as { kind?: string }).kind === "video") {
            const rr = r as unknown as Record<string, number>;
            bytesReceived = rr["bytesReceived"] ?? 0;
            packetsLost = rr["packetsLost"] ?? 0;
            packetsReceived = rr["packetsReceived"] ?? 0;
            framesPerSecond = rr["framesPerSecond"] ?? 0;
          }
        });
        const now = Date.now();
        const prev = lastStatsSampleRef.current;
        let kbps = 0;
        if (prev && now > prev.ts) {
          kbps = Math.round(((bytesReceived - prev.bytes) * 8) / (now - prev.ts));
        }
        lastStatsSampleRef.current = { bytes: bytesReceived, ts: now };
        const lossPct = packetsReceived > 0 ? (packetsLost / (packetsReceived + packetsLost)) * 100 : 0;
        setLiveStats({ kbps, fps: Math.round(framesPerSecond), lossPct: Math.round(lossPct * 10) / 10 });

        if (adaptiveBitrate && dc && dc.readyState === "open") {
          let target = currentBitrateKbpsRef.current;
          if (lossPct > 3) {
            // Losing packets — back off hard.
            target = Math.max(800, Math.round(target * 0.75));
          } else if (lossPct < 0.5 && kbps > target * 0.85) {
            // Clean channel and we're using most of the budget — try for more.
            target = Math.min(12_000, Math.round(target * 1.1));
          }
          if (target !== currentBitrateKbpsRef.current) {
            currentBitrateKbpsRef.current = target;
            dc.send(JSON.stringify({ type: "set-bitrate", kbps: target }));
          }
        }
      } catch {
        /* ignore — stats not ready yet */
      }
    }, 3000);
    return () => clearInterval(id);
  }, [isPlaying, adaptiveBitrate, showStatsOverlay, dataChannelOpen]);

  if (inviteError) {
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
            <CardTitle className="text-white">Приглашение недоступно</CardTitle>
            <CardDescription className="text-slate-500">{inviteError}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Link href="/hosts">
              <Button variant="outline" className="border-white/15 text-slate-300">
                К хостам
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (inviteLoading || !playerToken || isLoading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-3"
        style={{ background: "#06090e" }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
        <p className="text-sm text-slate-400">Подключаемся…</p>
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

  // Test session with a browser-hosted game: render it directly in an iframe.
  // No WebRTC, no billing, no agent needed.
  const sAny = session as any;
  const gameBrowserHostUrl: string | null = sAny.gameBrowserHostUrl ?? null;
  if ((sAny.isTest || sAny.is_test) && gameBrowserHostUrl) {
    const iframeUrl = gameBrowserHostUrl.startsWith("http")
      ? gameBrowserHostUrl
      : `${import.meta.env.BASE_URL}${gameBrowserHostUrl.replace(/^\//, "")}`;
    return (
      <IframeTestSession
        iframeUrl={iframeUrl}
        gameTitle={(session as any).gameTitle || session.appName}
      />
    );
  }

  if (!isPlaying) {
    const greenLzt = wallet?.withdrawableBalanceLzt ?? 0;
    const blueLzt = wallet?.internalBalanceLzt ?? 0;
    // Claim принимает только green/blue — не суммируем с кредитным лимитом.
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
    const needsTopUp =
      ratePerMinLzt > 0 && sourceBalance < ratePerMinLzt && !hasClaimed;
    const connecting =
      !needsTopUp &&
      !claimError &&
      (!playerWalletToken || claimSession.isPending || hasClaimed || session.status !== "ended");

    const s = session as typeof session & {
      gameCoverImageUrl?: string | null;
      gameTitle?: string | null;
    };
    const cover = s.gameCoverImageUrl
      ? s.gameCoverImageUrl.startsWith("http")
        ? s.gameCoverImageUrl
        : `${import.meta.env.BASE_URL}${s.gameCoverImageUrl.replace(/^\//, "")}`
      : null;

    // Happy path: fullscreen «Подключаемся…» without payment radios.
    if (connecting && !showPaymentOptions) {
      return (
        <div
          className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 relative overflow-hidden"
          style={{ background: "#06090e" }}
        >
          <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,rgba(14,165,233,0.12),transparent_55%)]" />
          {cover && (
            <div
              className="relative z-10 w-24 h-32 rounded-xl overflow-hidden mb-2"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <img
                src={cover}
                alt={s.gameTitle || session.appName}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <h1 className="relative z-10 text-xl font-bold text-white text-center">
            {s.gameTitle || session.appName}
          </h1>
          <div className="relative z-10 flex items-center gap-2 text-sky-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm font-medium">
              {!playerWalletToken
                ? "Создаём кошелёк…"
                : claimSession.isPending || !hasClaimed
                  ? "Занимаем сессию…"
                  : "Подключаемся…"}
            </span>
          </div>
          {ratePerMinLzt > 0 && (
            <p className="relative z-10 text-xs text-slate-500">
              {ratePerMinLzt} LZT/мин · {session.resolution} · {session.bitrateKbps} кбит/с
            </p>
          )}
        </div>
      );
    }

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
          <CardHeader className="text-center pb-4">
            {cover ? (
              <div
                className="w-28 h-36 mx-auto mb-4 rounded-xl overflow-hidden"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <img src={cover} alt={s.appName} className="w-full h-full object-cover" />
              </div>
            ) : (
              <Gamepad2 className="h-16 w-16 text-sky-400 mx-auto mb-6" />
            )}
            <CardTitle className="text-2xl font-bold tracking-tight mb-2 text-white">
              {s.gameTitle || session.appName}
            </CardTitle>
            <div className="flex items-center justify-center gap-2 text-xs text-slate-500 font-mono flex-wrap">
              <Badge variant="outline" className="border-white/10 text-slate-400">
                {session.resolution}
              </Badge>
              <Badge variant="outline" className="border-white/10 text-slate-400">
                {session.bitrateKbps} кбит/с
              </Badge>
              {(session as any).isTest ? (
                <Badge
                  variant="outline"
                  className="border-violet-400/40 text-violet-300"
                  data-testid="badge-test-session"
                >
                  Тест-сессия · бесплатно
                </Badge>
              ) : (
                <Badge variant="outline" className="border-sky-400/30 text-sky-300">
                  {ratePerMinLzt} LZT/мин
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg p-3 text-center" style={{ background: "rgba(255,255,255,0.03)" }}>
              <p className="text-xs text-slate-500 mb-1">Доступно (игровой + к выводу)</p>
              <p className="text-lg font-mono font-bold text-white">
                {totalLzt.toLocaleString("ru-RU")} LZT
              </p>
              {ratePerMinLzt > 0 && (
                <p className="text-[11px] text-slate-500 mt-1">~{minutesAffordable} мин игры</p>
              )}
            </div>

            {(claimError || showPaymentOptions) && (
              <div className="space-y-2">
                <button
                  type="button"
                  className="text-xs text-sky-400 hover:text-sky-300"
                  onClick={() => setShowPaymentOptions((v) => !v)}
                >
                  {showPaymentOptions ? "Скрыть способ оплаты" : "Выбрать способ оплаты"}
                </button>
                {showPaymentOptions && (
                  <RadioGroup
                    value={paymentSource}
                    onValueChange={(v) => setPaymentSource(v as PaymentSource)}
                    className="grid grid-cols-3 gap-2"
                    disabled={hasClaimed}
                  >
                    {(["auto", "green", "blue"] as PaymentSource[]).map((src) => (
                      <div key={src}>
                        <RadioGroupItem value={src} id={`src-${src}`} className="peer sr-only" />
                        <Label
                          htmlFor={`src-${src}`}
                          className="flex flex-col items-center justify-center rounded-md p-2 cursor-pointer text-xs text-slate-300"
                          style={{
                            background:
                              paymentSource === src
                                ? "rgba(14,165,233,0.12)"
                                : "rgba(255,255,255,0.02)",
                            border:
                              paymentSource === src
                                ? "2px solid #0ea5e9"
                                : "2px solid rgba(255,255,255,0.06)",
                          }}
                        >
                          <span className="font-bold">
                            {src === "auto" ? "Авто" : src === "green" ? "К выводу" : "Игровой"}
                          </span>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}
              </div>
            )}

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

            {needsTopUp ? (
              <Link href="/wallet" className="block">
                <Button
                  className="w-full h-12 text-base font-bold"
                  style={{ background: "#0ea5e9", color: "#fff" }}
                >
                  Пополнить кошелёк
                </Button>
              </Link>
            ) : (
              <Button
                className="w-full h-12 text-base font-bold"
                style={{ background: "#0ea5e9", color: "#fff" }}
                onClick={() => {
                  setClaimError(null);
                  setShowPaymentOptions(false);
                  void startConnection();
                }}
                disabled={session.status === "ended" || claimSession.isPending}
              >
                {claimSession.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Подключаемся…
                  </>
                ) : session.status === "ended" ? (
                  "Сессия завершена"
                ) : (
                  "Подключиться и играть"
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col relative overflow-hidden select-none">
      {/* Компактная нижняя панель — не блокирует игру и клики по экрану */}
      {playDock !== "none" && (
        <div
          className="fixed bottom-0 left-0 right-0 z-[60] px-3 pb-3 pt-2 pointer-events-auto"
          style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.85) 24%)" }}
        >
          <div
            className="max-w-lg mx-auto rounded-xl border px-4 py-3 shadow-lg"
            style={{ background: "#0c1420", borderColor: "rgba(255,255,255,0.1)" }}
          >
            {playDock === "block_hint" && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-amber-200">Скоро конец блока</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Осталось ~{blockMinsLeft ?? "?"} мин — продли, чтобы не обрывалось
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    disabled={renewBlockLoading}
                    style={{ background: "#0ea5e9", color: "#fff" }}
                    onClick={() => void renewBlock(15)}
                  >
                    +15 мин
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white/15 text-slate-300"
                    onClick={() => setPlayDock("none")}
                  >
                    Ок
                  </Button>
                </div>
              </div>
            )}

            {playDock === "block_end" && (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-slate-200">Время блока закончилось</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={renewBlockLoading}
                    style={{ background: "#0ea5e9", color: "#fff" }}
                    onClick={() => void renewBlock(15)}
                  >
                    Продлить 15 мин
                  </Button>
                  <Link href="/games">
                    <Button size="sm" variant="outline" className="border-white/15 text-slate-300">
                      В каталог
                    </Button>
                  </Link>
                  <Button size="sm" variant="ghost" className="text-slate-500" onClick={() => setPlayDock("none")}>
                    Закрыть
                  </Button>
                </div>
              </div>
            )}

            {playDock === "host_offline" && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <p className="text-sm text-red-300 flex-1">Хост отключился — списания остановлены</p>
                <Link href="/games">
                  <Button size="sm" style={{ background: "#0ea5e9", color: "#fff" }}>В каталог</Button>
                </Link>
              </div>
            )}

            {playDock === "balance" && (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm text-yellow-200 flex-1 min-w-[140px]">Баланс исчерпан</p>
                <Link href="/wallet">
                  <Button size="sm" style={{ background: "#0ea5e9", color: "#fff" }}>Пополнить</Button>
                </Link>
                <Link href="/games">
                  <Button size="sm" variant="outline" className="border-white/15 text-slate-300">Каталог</Button>
                </Link>
              </div>
            )}

            {playDock === "disconnect" && (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm text-yellow-200 flex-1 min-w-[140px]">Связь с хостом пропала</p>
                <Button
                  size="sm"
                  style={{ background: "#0ea5e9", color: "#fff" }}
                  onClick={() => {
                    setPlayDock("none");
                    if (pcRef.current) void triggerIceRestart(pcRef.current);
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1 inline" />
                  Переподключить
                </Button>
                <Button size="sm" variant="ghost" className="text-slate-400" onClick={cleanupConnection}>
                  Выйти
                </Button>
              </div>
            )}

            {playDock === "rating" && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-slate-200">Оцени сессию</p>
                  <button
                    type="button"
                    className="text-slate-500 hover:text-slate-300 text-xs"
                    onClick={() => {
                      setRatingSubmitted(true);
                      setPlayDock("none");
                    }}
                  >
                    Пропустить
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5 flex-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={`w-9 h-9 rounded-lg border text-sm font-medium ${
                          ratingScore === n
                            ? "border-sky-400 bg-sky-500/25 text-white"
                            : "border-white/10 text-slate-400 hover:border-white/25"
                        }`}
                        onClick={() => setRatingScore(n)}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <Button size="sm" style={{ background: "#0ea5e9", color: "#fff" }} onClick={() => void submitRating()}>
                    Отправить
                  </Button>
                </div>
              </div>
            )}
          </div>
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
              borderColor: reconnecting ? "#eab308" : connectionState === "connected" ? "#0ea5e9" : "#ef4444",
              color: reconnecting ? "#fde047" : connectionState === "connected" ? "#38bdf8" : "#f87171",
            }}
          >
            {reconnecting ? (
              <RefreshCw className="w-3 h-3 mr-2 inline animate-spin" />
            ) : connectionState === "connected" ? (
              <Wifi className="w-3 h-3 mr-2 inline" />
            ) : (
              <WifiOff className="w-3 h-3 mr-2 inline" />
            )}
            {reconnecting
              ? "ПЕРЕПОДКЛЮЧЕНИЕ..."
              : connectionState === "connected"
                ? "ПОДКЛЮЧЕНО"
                : connectionState === "connecting"
                  ? "СОЕДИНЕНИЕ"
                  : connectionState === "disconnected"
                    ? "ОТКЛЮЧЕНО"
                    : connectionState === "failed"
                      ? "ОШИБКА СВЯЗИ"
                      : connectionState === "closed"
                        ? "ЗАКРЫТО"
                        : connectionState === "new"
                          ? "ИНИЦИАЛИЗАЦИЯ"
                          : "ПОДКЛЮЧЕНИЕ"}
          </Badge>
          {iceType && !reconnecting && (
            <Badge
              variant="outline"
              className="bg-black/50 backdrop-blur font-mono text-[10px]"
              style={{
                borderColor: iceType === "relay" ? "#a855f7" : "#22c55e",
                color: iceType === "relay" ? "#c084fc" : "#86efac",
              }}
            >
              {getIceConnectionLabel(iceType)}
            </Badge>
          )}
          {/* E2E RTT indicator */}
          {e2eRtt !== null && !reconnecting && (
            <Badge
              variant="outline"
              className="bg-black/50 backdrop-blur font-mono text-[10px]"
              style={{
                borderColor: e2eRtt < 60 ? "#22c55e" : e2eRtt < 120 ? "#eab308" : "#ef4444",
                color: e2eRtt < 60 ? "#86efac" : e2eRtt < 120 ? "#fde047" : "#fca5a5",
              }}
            >
              <Activity className="w-2.5 h-2.5 inline mr-1" />
              {e2eRtt} мс
            </Badge>
          )}
        </div>

        {/* Block-time countdown HUD (shown only for block sessions) */}
        {blockMinsLeft !== null && isPlaying && (() => {
          const isDanger = blockMinsLeft <= 2;
          const isWarning = blockMinsLeft <= 5 && blockMinsLeft > 2;
          const blockColor = isDanger ? "#ef4444" : isWarning ? "#eab308" : "#22c55e";
          const blockBg = isDanger ? "rgba(239,68,68,0.15)" : isWarning ? "rgba(234,179,8,0.12)" : "rgba(34,197,94,0.10)";
          const blockBorder = isDanger ? "rgba(239,68,68,0.4)" : isWarning ? "rgba(234,179,8,0.35)" : "rgba(34,197,94,0.3)";
          return (
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 pointer-events-auto"
              style={{ background: blockBg, border: `1px solid ${blockBorder}` }}
            >
              {isDanger && <TrendingDown className="w-3.5 h-3.5 animate-pulse" style={{ color: blockColor }} />}
              <div className="text-right">
                <div className="font-mono font-bold text-sm leading-none" style={{ color: blockColor }}>
                  <Clock className="w-3 h-3 inline mr-1" />
                  {blockMinsLeft} мин
                </div>
                <div className="font-mono text-[10px] mt-0.5" style={{ color: blockColor, opacity: 0.75 }}>
                  блок
                </div>
              </div>
            </div>
          );
        })()}

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

        <div className="flex items-center gap-2">
          {/* Clip button — only when DC is open */}
          <div className="flex items-center gap-1 pointer-events-auto">
            <Button
              size="sm"
              onClick={() => void saveClip()}
              disabled={!dataChannelOpen || isSavingClip}
              title={dataChannelOpen ? "Сохранить последние ~30 сек" : "Доступно после подключения"}
              className="shadow-md gap-1.5"
              style={{
                background: dataChannelOpen ? "rgba(139,92,246,0.85)" : "rgba(100,100,100,0.4)",
                color: "#fff",
                opacity: dataChannelOpen ? 1 : 0.5,
              }}
            >
              {isSavingClip ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Clapperboard className="h-3.5 w-3.5" />
              )}
              Клип
            </Button>
            <Button
              size="sm"
              onClick={() => setShowClipSettings((v) => !v)}
              title="Настройки облачного сохранения"
              className="shadow-md px-2"
              style={{
                background: showClipSettings ? "rgba(139,92,246,0.6)" : "rgba(255,255,255,0.07)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <Settings2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Gamepad overlay toggle */}
          <button
            onClick={() => {
              setGamepadOverlay((v) => {
                if (v) setGamepadEditMode(false);
                return !v;
              });
            }}
            className="pointer-events-auto"
            title="Виртуальный геймпад"
            style={{
              background: gamepadOverlay ? "rgba(14,165,233,0.25)" : "rgba(255,255,255,0.08)",
              border: gamepadOverlay ? "1px solid rgba(14,165,233,0.6)" : "1px solid rgba(255,255,255,0.15)",
              borderRadius: 8,
              padding: "5px 8px",
              display: "flex",
              alignItems: "center",
              gap: 5,
              color: gamepadOverlay ? "#38bdf8" : "#94a3b8",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Gamepad2 style={{ width: 15, height: 15 }} />
            Геймпад
          </button>

          {/* Layout edit toggle — only shown when overlay is active */}
          {gamepadOverlay && (
            <button
              onClick={() => setGamepadEditMode((v) => !v)}
              className="pointer-events-auto"
              title="Редактировать раскладку"
              style={{
                background: gamepadEditMode ? "rgba(234,179,8,0.25)" : "rgba(255,255,255,0.06)",
                border: gamepadEditMode ? "1px solid rgba(234,179,8,0.7)" : "1px solid rgba(255,255,255,0.12)",
                borderRadius: 8,
                padding: "5px 8px",
                color: gamepadEditMode ? "#fde047" : "#64748b",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {gamepadEditMode ? "✓ Готово" : "✎"}
            </button>
          )}


          {/* Shader toggle button */}
          <button
            onClick={() => setShowShaderPanel((v) => !v)}
            className="pointer-events-auto"
            title="Шейдеры и пост-обработка"
            style={{
              background: shaderActive
                ? "rgba(16,185,129,0.25)"
                : showShaderPanel
                  ? "rgba(255,255,255,0.12)"
                  : "rgba(255,255,255,0.06)",
              border: shaderActive
                ? "1px solid rgba(16,185,129,0.6)"
                : "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8,
              padding: "5px 8px",
              display: "flex",
              alignItems: "center",
              gap: 5,
              color: shaderActive ? "#34d399" : "#64748b",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Layers style={{ width: 15, height: 15 }} />
            {shaderActive ? SHADER_PRESETS[activePreset as Exclude<PresetKey, "custom">]?.label ?? "Кастом" : "Шейдер"}
          </button>

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
      </div>

      {/* Shader / post-processing panel */}
      {showShaderPanel && (
        <div
          className="absolute top-16 right-4 z-50 rounded-xl p-4 pointer-events-auto"
          style={{
            background: "#0a1018",
            border: "1px solid rgba(16,185,129,0.3)",
            width: 320,
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-white flex items-center gap-2">
              <Layers className="h-4 w-4 text-emerald-400" />
              Пост-обработка
            </span>
            <button onClick={() => setShowShaderPanel(false)} className="text-slate-500 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Preset chips */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {(["none", "sharpen", "contrast", "upscale", "night"] as const).map((key) => (
              <button
                key={key}
                onClick={() => {
                  setActivePreset(key);
                  localStorage.setItem("shaderPreset", key);
                  setShaderCompileError(null);
                }}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  background:
                    activePreset === key
                      ? "rgba(16,185,129,0.25)"
                      : "rgba(255,255,255,0.05)",
                  border:
                    activePreset === key
                      ? "1px solid rgba(16,185,129,0.6)"
                      : "1px solid rgba(255,255,255,0.10)",
                  color: activePreset === key ? "#34d399" : "#94a3b8",
                }}
              >
                {SHADER_PRESETS[key].label}
              </button>
            ))}
            <button
              onClick={() => {
                setActivePreset("custom" as PresetKey);
                localStorage.setItem("shaderPreset", "custom");
              }}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                background:
                  activePreset === "custom"
                    ? "rgba(139,92,246,0.25)"
                    : "rgba(255,255,255,0.05)",
                border:
                  activePreset === "custom"
                    ? "1px solid rgba(139,92,246,0.6)"
                    : "1px solid rgba(255,255,255,0.10)",
                color: activePreset === "custom" ? "#a78bfa" : "#94a3b8",
              }}
            >
              GLSL
            </button>
          </div>

          {/* Description */}
          {activePreset !== "custom" && (
            <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
              {SHADER_PRESETS[activePreset as Exclude<PresetKey, "custom">]?.description}
            </p>
          )}

          {/* Custom GLSL editor */}
          {activePreset === "custom" && (
            <div className="space-y-2">
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Пиши fragment shader на GLSL. Доступно:{" "}
                <code className="text-violet-400">uVideo</code>,{" "}
                <code className="text-violet-400">uResolution</code>,{" "}
                <code className="text-violet-400">uTime</code>,{" "}
                <code className="text-violet-400">vTexCoord</code>.
              </p>
              <textarea
                value={customShaderCode}
                onChange={(e) => {
                  setCustomShaderCode(e.target.value);
                  localStorage.setItem("shaderCustomCode", e.target.value);
                  setShaderCompileError(null);
                }}
                spellCheck={false}
                rows={10}
                className="w-full rounded-md text-xs font-mono text-emerald-300 outline-none resize-y"
                style={{
                  background: "rgba(0,0,0,0.5)",
                  border: shaderCompileError
                    ? "1px solid rgba(239,68,68,0.6)"
                    : "1px solid rgba(255,255,255,0.08)",
                  padding: "8px 10px",
                  lineHeight: 1.5,
                  minHeight: 140,
                }}
              />
              {shaderCompileError && (
                <p className="text-[11px] text-red-400 font-mono leading-relaxed whitespace-pre-wrap">
                  {shaderCompileError}
                </p>
              )}
            </div>
          )}

          {shaderActive && !shaderCompileError && activePreset !== "custom" && (
            <div
              className="flex items-center gap-1.5 text-[11px] text-emerald-500 mt-1"
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
              Активно
            </div>
          )}

          {/* Stream quality settings */}
          <div className="mt-4 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-white">Качество стрима</span>
              <button
                onClick={() => setAdaptiveBitrate((v) => !v)}
                style={{
                  padding: "2px 8px",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: adaptiveBitrate ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.06)",
                  border: adaptiveBitrate ? "1px solid rgba(16,185,129,0.6)" : "1px solid rgba(255,255,255,0.12)",
                  color: adaptiveBitrate ? "#34d399" : "#94a3b8",
                }}
              >
                Авто {adaptiveBitrate ? "вкл" : "выкл"}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">
              {adaptiveBitrate
                ? "Битрейт подстраивается под канал автоматически (меньше фризов, апскейл сглаживает картинку по умолчанию)."
                : "Битрейт фиксирован вручную."}
            </p>

            {!adaptiveBitrate && (
              <div className="mb-3">
                <div className="flex items-center justify-between text-[10px] uppercase text-slate-400 tracking-wider mb-1">
                  <span>Битрейт</span>
                  <span>{manualBitrateKbps} кбит/с</span>
                </div>
                <input
                  type="range"
                  min={800}
                  max={12000}
                  step={200}
                  value={manualBitrateKbps}
                  onChange={(e) => setManualBitrateKbps(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            )}

            <div className="mb-3">
              <div className="flex items-center justify-between text-[10px] uppercase text-slate-400 tracking-wider mb-1">
                <span>Лимит FPS</span>
                <span>{fpsCapHint}</span>
              </div>
              <div className="flex gap-1.5">
                {[30, 60, 90, 120].map((fps) => (
                  <button
                    key={fps}
                    onClick={() => setFpsCapHint(fps)}
                    style={{
                      flex: 1,
                      padding: "3px 0",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      background: fpsCapHint === fps ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.05)",
                      border: fpsCapHint === fps ? "1px solid rgba(16,185,129,0.6)" : "1px solid rgba(255,255,255,0.10)",
                      color: fpsCapHint === fps ? "#34d399" : "#94a3b8",
                    }}
                  >
                    {fps}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowStatsOverlay((v) => !v)}
              className="w-full text-left"
              style={{
                padding: "5px 8px",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                background: showStatsOverlay ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.05)",
                border: showStatsOverlay ? "1px solid rgba(16,185,129,0.4)" : "1px solid rgba(255,255,255,0.10)",
                color: showStatsOverlay ? "#34d399" : "#94a3b8",
              }}
            >
              {showStatsOverlay ? "✓" : ""} Показывать статистику (пинг / кбит/с / потери)
            </button>
          </div>
        </div>
      )}

      {/* Live stream stats overlay */}
      {showStatsOverlay && isPlaying && (
        <div
          className="absolute bottom-4 left-4 z-40 rounded-lg px-3 py-2 pointer-events-none font-mono text-[11px] text-slate-300"
          style={{ background: "rgba(10,16,24,0.75)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div>ping: {e2eRtt !== null ? `${e2eRtt} мс` : "—"}</div>
          <div>битрейт: {liveStats ? `${liveStats.kbps} кбит/с` : "—"}</div>
          <div>fps: {liveStats ? liveStats.fps : "—"}</div>
          <div>потери: {liveStats ? `${liveStats.lossPct}%` : "—"}</div>
        </div>
      )}

      {/* Clip cloud-upload settings panel */}
      {showClipSettings && (
        <div
          className="absolute top-16 right-4 z-50 w-72 rounded-xl p-4 pointer-events-auto"
          style={{ background: "#0a1018", border: "1px solid rgba(139,92,246,0.35)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-white">Облачное сохранение клипов</span>
            <button onClick={() => setShowClipSettings(false)} className="text-slate-500 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
            Если авторизован — клипы загружаются на платформу автоматически.
            Ниже — кастомный S3-совместимый endpoint (PUT).
            Используй <code className="text-violet-400">{"{filename}"}</code> в URL как плейсхолдер.
          </p>
          <div className="space-y-2">
            <div>
              <label className="text-[10px] uppercase text-slate-400 tracking-wider">PUT URL</label>
              <input
                className="w-full mt-0.5 px-2 py-1.5 rounded-md text-xs font-mono text-white bg-black/40 border border-white/10 outline-none focus:border-violet-400"
                placeholder="https://bucket.s3.region.amazonaws.com/{filename}?..."
                defaultValue={localStorage.getItem("clipS3Endpoint") ?? ""}
                onChange={(e) => {
                  if (e.target.value) localStorage.setItem("clipS3Endpoint", e.target.value);
                  else localStorage.removeItem("clipS3Endpoint");
                }}
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-slate-400 tracking-wider">API Key (необязательно)</label>
              <input
                className="w-full mt-0.5 px-2 py-1.5 rounded-md text-xs font-mono text-white bg-black/40 border border-white/10 outline-none focus:border-violet-400"
                placeholder="ключ доступа"
                type="password"
                defaultValue={localStorage.getItem("clipS3Key") ?? ""}
                onChange={(e) => {
                  if (e.target.value) localStorage.setItem("clipS3Key", e.target.value);
                  else localStorage.removeItem("clipS3Key");
                }}
              />
            </div>
          </div>
          <p className="text-[10px] text-slate-600 mt-3">Настройки хранятся локально в браузере.</p>
        </div>
      )}

      <div className="flex-1 relative flex items-center justify-center bg-black cursor-crosshair">
        {connectionState !== "connected" && !reconnecting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-40 backdrop-blur-sm">
            <Loader2 className="h-12 w-12 animate-spin text-sky-400 mb-4" />
            <div className="font-mono text-sky-400 font-bold tracking-widest uppercase">
              Устанавливаем WebRTC-соединение
            </div>
          </div>
        )}
        {reconnecting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-40 backdrop-blur-sm">
            <RefreshCw className="h-12 w-12 animate-spin text-yellow-400 mb-4" />
            <div className="font-mono text-yellow-400 font-bold tracking-widest uppercase">
              Переподключение...
            </div>
            <div className="font-mono text-slate-500 text-xs mt-2">
              Восстанавливаем ICE-соединение
            </div>
          </div>
        )}

        {/* WebGL shader canvas — overlays video when a shader is active */}
        <WebGLVideoShader
          videoRef={videoRef}
          fragCode={activeFrag}
          active={shaderActive}
          className="w-full h-full object-contain pointer-events-auto absolute inset-0"
          style={{ zIndex: shaderActive ? 1 : -1 }}
          onCompileError={setShaderCompileError}
        />

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={false}
          className="w-full h-full object-contain pointer-events-auto"
          style={{ opacity: shaderActive ? 0 : 1, pointerEvents: shaderActive ? "none" : "auto" }}
          onClick={requestPointerLock}
        />

        {/* Virtual gamepad overlay */}
        {isPlaying && gamepadOverlay && (
          <TouchOverlay onGamepadInput={sendGamepadInput} editMode={gamepadEditMode} />
        )}

        {/* Keyboard key overlay */}
        {isPlaying && keyboardOverlay && (
          <KeyboardOverlay onKeyInput={sendKeyboardInput} editMode={keyboardEditMode} />
        )}

        {/* Floating keyboard toggle — bottom-right, thumb-reachable on mobile */}
        {isPlaying && (
          <div
            style={{
              position: "absolute",
              bottom: 72,
              right: 12,
              zIndex: 30,
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 6,
              pointerEvents: "auto",
            }}
          >
            {keyboardOverlay && (
              <button
                onClick={() => setKeyboardEditMode((v) => !v)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: keyboardEditMode ? "rgba(234,179,8,0.35)" : "rgba(255,255,255,0.10)",
                  border: keyboardEditMode ? "2px solid rgba(234,179,8,0.8)" : "2px solid rgba(255,255,255,0.22)",
                  color: keyboardEditMode ? "#fde047" : "#94a3b8",
                  fontSize: 17,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  backdropFilter: "blur(6px)",
                  touchAction: "none",
                }}
                title="Настроить клавиши"
              >
                {keyboardEditMode ? "✓" : "✎"}
              </button>
            )}
            <button
              onClick={() => {
                setKeyboardOverlay((v) => {
                  if (v) setKeyboardEditMode(false);
                  return !v;
                });
              }}
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: keyboardOverlay ? "rgba(234,179,8,0.28)" : "rgba(255,255,255,0.10)",
                border: keyboardOverlay ? "2px solid rgba(234,179,8,0.7)" : "2px solid rgba(255,255,255,0.22)",
                color: keyboardOverlay ? "#fde047" : "#94a3b8",
                fontSize: 22,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                backdropFilter: "blur(6px)",
                touchAction: "none",
              }}
              title="Клавиши на экране"
            >
              ⌨
            </button>
          </div>
        )}

        {showAudioPrompt && (
          <div className="fixed bottom-20 left-0 right-0 z-40 flex justify-center pointer-events-none px-4">
            <Button
              size="sm"
              onClick={() => {
                handleEnableAudio();
                toast.message("Звук включён");
              }}
              className="pointer-events-auto font-medium gap-2 shadow-lg"
              style={{ background: "#0ea5e9", color: "#fff" }}
            >
              <VolumeX className="h-4 w-4" />
              Нажмите для звука
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
