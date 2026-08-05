import { useCallback, useEffect, useRef, useState } from "react";
import { formatApiErrorPanel } from "@/lib/api-errors";
import { useSearch } from "wouter";
import { Loader2, AlertCircle, WifiOff } from "lucide-react";
import {
  createEmbedSession,
  getPublicIceConfig,
  useGetSessionByPlayerToken,
  getGetSessionByPlayerTokenQueryKey,
  type CreateEmbedSessionResponse,
} from "@workspace/api-client-react";

// ---------------------------------------------------------------------------
// Embeddable widget (task-125): third-party sites drop this page into an
// <iframe src="…/embed?apiKey=…&game=…">. Unlike /play/:playerToken, there is
// no end-player login/wallet here at all — the session is created and billed
// entirely against the dev key's own LZT balance via POST /embed/sessions.
// Query params:
//   apiKey (required)  — the developer's API key / wallet token
//   game   (required)  — game slug to launch
//   resolution, bitrateKbps (optional)
// ---------------------------------------------------------------------------

import {
  parseEmbedQueryParams,
  buildEmbedMissingParamsError,
  getEmbedEndedTitle,
  getEmbedEndedDetail,
  buildEmbedSignalWsUrl,
} from "./embed-helpers";

const isDev = import.meta.env.DEV;

export default function Embed() {
  const search$ = useSearch();
  const { apiKey, gameSlug, resolution, bitrateKbps } = parseEmbedQueryParams(search$);

  const [session, setSession] = useState<CreateEmbedSessionResponse | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>("new");
  const [ended, setEnded] = useState<{ reason: string } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const startedRef = useRef(false);
  const wsReconnectDelayRef = useRef(1000);
  const wsReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Create the session (host selection + balance check happen server-side).
  useEffect(() => {
    if (!apiKey || !gameSlug) {
      setError(buildEmbedMissingParamsError());
      return;
    }
    let cancelled = false;
    setSession(null);
    setError(null);
    setEnded(null);
    startedRef.current = false;
    void (async () => {
      try {
        const data = await createEmbedSession({
          apiKey,
          gameSlug,
          resolution,
          bitrateKbps,
        });
        if (!cancelled) setSession(data);
      } catch (err) {
        if (!cancelled) setError(err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiKey, gameSlug, resolution, bitrateKbps]);

  const playerToken = session?.playerToken ?? "";
  const { data: sessionStatus } = useGetSessionByPlayerToken(playerToken, {
    query: {
      enabled: !!playerToken && !ended,
      queryKey: getGetSessionByPlayerTokenQueryKey(playerToken),
      refetchInterval: 5000,
    },
  });

  const cleanupConnection = useCallback(() => {
    if (wsReconnectTimerRef.current) {
      clearTimeout(wsReconnectTimerRef.current);
      wsReconnectTimerRef.current = null;
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
  }, []);

  // 3. Poll session status so we can surface "key balance exhausted" and
  // other end reasons explicitly, per task-125 requirements.
  useEffect(() => {
    if (sessionStatus?.status === "ended") {
      setEnded({ reason: sessionStatus.endReason ?? "ended" });
      cleanupConnection();
    }
  }, [sessionStatus, cleanupConnection]);

  const connectWs = useCallback((url: string, pc: RTCPeerConnection) => {
    if (wsReconnectTimerRef.current) {
      clearTimeout(wsReconnectTimerRef.current);
      wsReconnectTimerRef.current = null;
    }
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      wsReconnectDelayRef.current = 1000;
    };

    ws.onmessage = async (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as {
          type: string;
          sdp?: RTCSessionDescriptionInit;
          candidate?: RTCIceCandidateInit;
        };
        if (msg.type === "offer" && msg.sdp) {
          await pc.setRemoteDescription(msg.sdp);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          ws.send(JSON.stringify({ type: "answer", sdp: answer }));
        } else if (msg.type === "ice-candidate" && msg.candidate) {
          await pc.addIceCandidate(msg.candidate);
        }
      } catch (err) {
        if (isDev) console.error("[embed] signaling message error", err);
      }
    };

    ws.onclose = () => {
      if (!startedRef.current) return;
      const delay = wsReconnectDelayRef.current;
      wsReconnectDelayRef.current = Math.min(delay * 2, 8000);
      wsReconnectTimerRef.current = setTimeout(() => connectWs(url, pc), delay);
    };
  }, []);

  // 2. WebRTC once session exists.
  useEffect(() => {
    if (!session || startedRef.current) return;
    startedRef.current = true;

    void (async () => {
      const wsUrl = buildEmbedSignalWsUrl(
        session.playerToken,
        window.location.protocol,
        window.location.host,
        import.meta.env.BASE_URL,
      );

      let iceServers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
      try {
        const cfgJson = await getPublicIceConfig();
        const valid = (cfgJson.iceServers ?? []).filter((s) => s && s.urls);
        if (valid.length > 0) iceServers = valid;
      } catch {
        // fall back to default STUN
      }

      const pc = new RTCPeerConnection({ iceServers });
      pcRef.current = pc;

      pc.onconnectionstatechange = () => {
        setConnectionState(pc.connectionState);
        if (pc.connectionState === "closed" || pc.connectionState === "failed") {
          cleanupConnection();
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
            /* autoplay may require a user gesture inside the iframe */
          });
        }
      };

      connectWs(wsUrl, pc);
    })();

    return () => cleanupConnection();
  }, [session, cleanupConnection, connectWs]);

  if (error) {
    const mapped = formatApiErrorPanel(error, {
      title: "Не удалось начать сессию",
      detail: "Попробуйте позже или проверьте параметры.",
    });
    return (
      <EmbedMessage
        icon={<AlertCircle className="h-8 w-8 text-red-400" />}
        title={mapped.title}
        detail={mapped.detail}
      />
    );
  }

  if (ended) {
    return (
      <EmbedMessage
        icon={<WifiOff className="h-8 w-8 text-amber-400" />}
        title={getEmbedEndedTitle(ended.reason)}
        detail={getEmbedEndedDetail(ended.reason)}
      />
    );
  }

  if (!session) {
    return (
      <EmbedMessage
        icon={<Loader2 className="h-8 w-8 animate-spin text-white/70" />}
        title="Запускаем игровую сессию…"
      />
    );
  }

  return (
    <div className="h-screen w-screen bg-black relative overflow-hidden">
      <video ref={videoRef} autoPlay playsInline className="h-full w-full object-contain bg-black" />
      {connectionState !== "connected" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <div className="flex flex-col items-center gap-2 text-white/80">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-sm">Подключение к {session.hostDisplayName}…</span>
          </div>
        </div>
      )}
    </div>
  );
}

function EmbedMessage({ icon, title, detail }: { icon: React.ReactNode; title: string; detail?: string }) {
  return (
    <div className="h-screen w-screen bg-black flex items-center justify-center p-6">
      <div className="flex flex-col items-center gap-3 text-center max-w-sm">
        {icon}
        <p className="text-white font-medium">{title}</p>
        {detail && <p className="text-white/60 text-sm">{detail}</p>}
      </div>
    </div>
  );
}
