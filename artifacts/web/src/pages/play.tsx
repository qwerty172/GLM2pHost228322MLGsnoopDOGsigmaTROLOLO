import { useCallback, useEffect, useRef, useState } from "react";
import { useRoute, Link, useSearch } from "wouter";
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
import { Gamepad2, AlertCircle, ArrowLeft, Loader2, Wifi, WifiOff, VolumeX, Wallet, Banknote, Coins, Clock, TrendingDown, Activity, RefreshCw, Clapperboard, Settings2, X, Layers } from "lucide-react";
import { WebGLVideoShader, SHADER_PRESETS, type PresetKey } from "@/components/webgl-video-shader";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { TouchOverlay } from "@/components/TouchOverlay";

const LZT_PER_USDT = 200;
type PaymentSource = "auto" | "blue" | "green";
import { toast } from "sonner";
import { usePlayerWallet } from "@/hooks/use-player-wallet";

export default function Play() {
  const [, params] = useRoute("/play/:playerToken");
  const playerToken = params?.playerToken || "";
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
      refetchInterval: 8000,
    }
  });

  const { playerWalletToken, registerGuest } = usePlayerWallet();

  // Auto-register a guest account when a user lands directly on /play/:playerToken
  // without having gone through the landing page or game-detail "Play" button.
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

  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>("new");
  const [isPlaying, setIsPlaying] = useState(false);
  const [showAudioPrompt, setShowAudioPrompt] = useState(false);
  const [iceType, setIceType] = useState<"relay" | "srflx" | "host" | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [longDisconnect, setLongDisconnect] = useState(false);
  const [e2eRtt, setE2eRtt] = useState<number | null>(null);
  const [dataChannelOpen, setDataChannelOpen] = useState(false);
  const [isSavingClip, setIsSavingClip] = useState(false);
  const [showClipSettings, setShowClipSettings] = useState(false);

  // Shader / post-processing state
  const [showShaderPanel, setShowShaderPanel] = useState(false);
  const [activePreset, setActivePreset] = useState<PresetKey>(
    () => (localStorage.getItem("shaderPreset") as PresetKey | null) ?? "none",
  );
  const [customShaderCode, setCustomShaderCode] = useState(
    () => localStorage.getItem("shaderCustomCode") ?? SHADER_PRESETS.sharpen.code,
  );
  const [shaderCompileError, setShaderCompileError] = useState<string | null>(null);
  const shaderActive = activePreset !== "none";
  const activeFrag =
    activePreset === "custom" ? customShaderCode : SHADER_PRESETS[activePreset as Exclude<PresetKey, "custom">]?.code ?? SHADER_PRESETS.none.code;

  // Virtual gamepad overlay — auto-enabled on touch devices
  const [gamepadOverlay, setGamepadOverlay] = useState<boolean>(
    () => navigator.maxTouchPoints > 0,
  );
  // Layout edit mode: lets players drag-to-reposition each control
  const [gamepadEditMode, setGamepadEditMode] = useState(false);

  // Live HUD: client-side ticking balance estimate between API syncs
  const [estimatedBalanceLzt, setEstimatedBalanceLzt] = useState<number | null>(null);
  const ratePerSecLztRef = useRef<number>(0);
  const sessionEndReasonRef = useRef<string | null>(null);

  // Block-time billing state
  const [blockMinsLeft, setBlockMinsLeft] = useState<number | null>(null);
  const [showBlockExpiredModal, setShowBlockExpiredModal] = useState(false);
  const blockWarningShownRef = useRef(false);

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

  // Detect host_offline, balance_exhausted, and block_expired end reasons
  useEffect(() => {
    if (!session) return;
    const reason = (session as typeof session & { endReason?: string | null }).endReason ?? null;
    sessionEndReasonRef.current = reason;
    if (session.status === "ended" && isPlaying) {
      if (reason === "host_offline") {
        toast.error("Хост отключился. Списания остановлены.");
      } else if (reason === "balance_exhausted") {
        toast.error("Баланс исчерпан. Сессия завершена.");
      } else if (reason === "block_expired") {
        setShowBlockExpiredModal(true);
      }
    }
  }, [session?.status, (session as typeof session & { endReason?: string | null })?.endReason, isPlaying]);

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
    setLongDisconnect(false);
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
      console.log("[clip] Recorder started, mimeType:", mimeType);
    } catch (err) {
      console.warn("[clip] MediaRecorder init failed:", err);
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
          console.log("[clip] Uploaded to platform storage");
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
      console.log("[clip] Uploaded to custom S3:", uploadUrl);
    } catch (err) {
      console.warn("[clip] Custom S3 upload failed:", err);
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
      console.error("[clip] Save failed:", err);
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
      console.log("[ice-restart] Sent re-offer to host");
    } catch (err) {
      console.warn("[ice-restart] Failed to create re-offer:", err);
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
          setShowBlockExpiredModal(true);
        }
      } catch (err) {
        console.error("Error handling WS message", err);
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
      console.log(`[ws] Disconnected — reconnecting in ${delay}ms`);
      wsReconnectTimerRef.current = setTimeout(() => {
        connectWs(url, pc);
      }, delay);
    };
  }, [cleanupConnection, setupDataChannel, triggerIceRestart]);

  const startConnection = useCallback(async () => {
    if (!playerToken || startedRef.current) return;
    startedRef.current = true;

    setIsPlaying(true);
    setConnectionState("connecting");

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    if (!playerWalletToken) return;
    const wsUrl = `${wsProtocol}//${window.location.host}${import.meta.env.BASE_URL}api/signal?role=player&playerToken=${playerToken}&playerWalletToken=${playerWalletToken}`;
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
      console.warn("[ice] Failed to fetch ICE config, using default STUN only");
    }

    const pc = new RTCPeerConnection({ iceServers });
    pcRef.current = pc;

    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
      if (pc.connectionState === "connected") {
        // Cleared reconnecting state on successful reconnect.
        setReconnecting(false);
        if (longDisconnectTimerRef.current) { clearTimeout(longDisconnectTimerRef.current); longDisconnectTimerRef.current = null; }
        setLongDisconnect(false);
        // Log the ICE candidate type for diagnostics.
        void pc.getStats().then((stats) => {
          stats.forEach((report) => {
            if (report.type === "candidate-pair" && report.state === "succeeded") {
              const localId: string = report.localCandidateId as string;
              stats.forEach((r) => {
                if (r.id === localId && r.type === "local-candidate") {
                  const t = r.candidateType as string;
                  const mapped = t === "relay" ? "relay" : t === "srflx" ? "srflx" : "host";
                  console.log(`[ice] connection type: ${mapped}`);
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
      console.log(`[ice] iceConnectionState: ${state}`);

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
          setLongDisconnect(true);
        }, 30000);
      } else if (state === "failed") {
        // Immediate restart attempt on failed (more severe than disconnected).
        setReconnecting(true);
        if (iceRestartTimerRef.current) clearTimeout(iceRestartTimerRef.current);
        void triggerIceRestart(pc);

        if (longDisconnectTimerRef.current) clearTimeout(longDisconnectTimerRef.current);
        longDisconnectTimerRef.current = setTimeout(() => {
          setLongDisconnect(true);
        }, 30000);
      } else if (state === "connected" || state === "completed") {
        // Clear reconnect state on recovery.
        if (iceRestartTimerRef.current) { clearTimeout(iceRestartTimerRef.current); iceRestartTimerRef.current = null; }
        if (longDisconnectTimerRef.current) { clearTimeout(longDisconnectTimerRef.current); longDisconnectTimerRef.current = null; }
        setReconnecting(false);
        setLongDisconnect(false);
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
  }, [playerToken, playerWalletToken, cleanupConnection, connectWs, triggerIceRestart, initClipRecorder]);

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
        data: { playerWalletToken, paymentSource, ...(blockMinutesParam ? { blockMinutes: blockMinutesParam } : {}) },
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

  const sendGamepadInput = useCallback((axes: number[], buttons: number[]) => {
    const dc = dcRef.current;
    if (dc && dc.readyState === "open") {
      dc.send(JSON.stringify({ type: "gamepad", axes, buttons }));
    }
  }, []);

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
      auto: "Авто (сначала «К выводу», потом игровой)",
      green: "Баланс «К выводу»",
      blue: "Игровой баланс",
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
                {ratePerMinLzt} LZT/мин
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
                  <Wallet className="h-3 w-3" /> Игровой
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
                  <Banknote className="h-3 w-3" /> К выводу
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
                        {s === "auto" ? "Авто" : s === "green" ? "К выводу" : "Игровой"}
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

      {/* Block expired modal */}
      {showBlockExpiredModal && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <Card className="w-full max-w-sm mx-4" style={{ background: "#0a1018", border: "1px solid rgba(14,165,233,0.4)" }}>
            <CardHeader className="text-center pb-2">
              <Clock className="h-10 w-10 text-sky-400 mx-auto mb-3" />
              <CardTitle className="text-white">Время блока истекло</CardTitle>
              <CardDescription className="text-slate-400">
                Оплаченный блок игрового времени использован. Неиспользованные LZT возвращены на баланс.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Link href="/games">
                <Button className="w-full" style={{ background: "#0ea5e9", color: "#fff" }}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> В каталог
                </Button>
              </Link>
              <Button variant="outline" className="w-full border-white/10 text-slate-300" onClick={() => setShowBlockExpiredModal(false)}>
                Закрыть
              </Button>
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

      {/* Long disconnect modal — shown after >30s of failed reconnect */}
      {longDisconnect && (
        <div className="absolute inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <Card className="w-full max-w-sm mx-4" style={{ background: "#0a1018", border: "1px solid rgba(234,179,8,0.4)" }}>
            <CardHeader className="text-center pb-2">
              <WifiOff className="h-10 w-10 text-yellow-400 mx-auto mb-3" />
              <CardTitle className="text-white">Соединение потеряно</CardTitle>
              <CardDescription className="text-slate-400">
                Не удаётся восстановить связь с хостом. Попробуй переподключиться.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button
                className="w-full"
                style={{ background: "#0ea5e9", color: "#fff" }}
                onClick={() => {
                  setLongDisconnect(false);
                  if (pcRef.current) void triggerIceRestart(pcRef.current);
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" /> Переподключиться
              </Button>
              <Button variant="outline" className="w-full border-white/10 text-slate-300" onClick={cleanupConnection}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Завершить сессию
              </Button>
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
                  : connectionState.toUpperCase()}
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
              {iceType === "relay" ? "TURN" : iceType === "srflx" ? "STUN" : "P2P"}
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
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 pointer-events-none"
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
