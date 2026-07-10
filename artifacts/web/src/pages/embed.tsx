import { useCallback, useEffect, useRef, useState } from "react";
import { useSearch } from "wouter";
import { Loader2, AlertCircle, WifiOff } from "lucide-react";

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

type EmbedSession = {
  sessionId: string;
  playerToken: string;
  gameSlug: string;
  gameTitle: string;
  hostDisplayName: string;
  ratePerMinuteLzt: number;
  keyBalanceLzt: number;
};

type EmbedApiError = { error: string; message: string };

export default function Embed() {
  const search$ = useSearch();
  const params = new URLSearchParams(search$);
  const apiKey = params.get("apiKey") || "";
  const gameSlug = params.get("game") || "";
  const resolution = params.get("resolution") || undefined;
  const bitrateKbpsParam = Number(params.get("bitrateKbps"));
  const bitrateKbps = Number.isFinite(bitrateKbpsParam) && bitrateKbpsParam > 0 ? bitrateKbpsParam : undefined;

  const [session, setSession] = useState<EmbedSession | null>(null);
  const [error, setError] = useState<EmbedApiError | null>(null);
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
      setError({ error: "missing_params", message: "apiKey and game query params are required" });
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}api/embed/sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey, gameSlug, resolution, bitrateKbps }),
        });
        const json = (await res.json()) as EmbedSession | EmbedApiError;
        if (cancelled) return;
        if (!res.ok) {
          setError(json as EmbedApiError);
          return;
        }
        setSession(json as EmbedSession);
      } catch {
        if (!cancelled) {
          setError({ error: "network_error", message: "Could not reach the game server" });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanupConnection = useCallback(() => {
    if (wsReconnectTimerRef.current) { clearTimeout(wsReconnectTimerRef.current); wsReconnectTimerRef.current = null; }
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    startedRef.current = false;
    setConnectionState("closed");
  }, []);

  const connectWs = useCallback((url: string, pc: RTCPeerConnection) => {
    if (!startedRef.current) return;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      wsReconnectDelayRef.current = 1000;
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data as string) as Record<string, unknown>;
        const type = msg["type"] as string;
        if (type === "offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(msg["sdp"] as RTCSessionDescriptionInit));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          ws.send(JSON.stringify({ type: "answer", sdp: answer }));
        } else if (type === "ice-candidate") {
          await pc.addIceCandidate(new RTCIceCandidate(msg["candidate"] as RTCIceCandidateInit));
        } else if (type === "control" && msg["action"] === "reject") {
          setEnded({ reason: (msg["reason"] as string) ?? "rejected" });
          cleanupConnection();
        }
      } catch (err) {
        console.error("[embed] signaling message error", err);
      }
    };

    ws.onclose = () => {
      if (!startedRef.current) return;
      const delay = wsReconnectDelayRef.current;
      wsReconnectDelayRef.current = Math.min(delay * 2, 8000);
      wsReconnectTimerRef.current = setTimeout(() => connectWs(url, pc), delay);
    };
  }, [cleanupConnection]);

  // 2. Once a session exists, connect via WebRTC signaling — no player wallet
  // token is sent; the server recognizes this session as dev-key funded.
  useEffect(() => {
    if (!session || startedRef.current) return;
    startedRef.current = true;
    setConnectionState("connecting");

    void (async () => {
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${wsProtocol}//${window.location.host}${import.meta.env.BASE_URL}api/signal?role=player&playerToken=${session.playerToken}`;

      let iceServers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
      try {
        const cfgRes = await fetch(`${import.meta.env.BASE_URL}api/public/ice-config`);
        if (cfgRes.ok) {
          const cfgJson = (await cfgRes.json()) as { iceServers: RTCIceServer[] };
          // Defensively validate each entry — malformed TURN config (e.g. a
          // misconfigured `urls` value) must not crash the widget's
          // RTCPeerConnection constructor inside a third-party iframe.
          const isValidUrl = (u: string) => /^(stun|turn|turns):/.test(u);
          const valid = (cfgJson.iceServers ?? []).filter((s) => {
            const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
            return urls.every((u) => typeof u === "string" && isValidUrl(u));
          });
          if (valid.length > 0) iceServers = valid;
        }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // 3. Poll session status so we can surface "key balance exhausted" and
  // other end reasons explicitly, per task-125 requirements.
  useEffect(() => {
    if (!session || ended) return;
    const id = setInterval(() => {
      void fetch(`${import.meta.env.BASE_URL}api/sessions/by-player-token/${session.playerToken}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((s: { status?: string; endReason?: string | null } | null) => {
          if (s?.status === "ended") {
            setEnded({ reason: s.endReason ?? "ended" });
            cleanupConnection();
          }
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(id);
  }, [session, ended, cleanupConnection]);

  if (error) {
    return (
      <EmbedMessage
        icon={<AlertCircle className="h-8 w-8 text-red-400" />}
        title={
          error.error === "key_balance_exhausted"
            ? "API key balance exhausted"
            : error.error === "invalid_api_key"
              ? "Invalid API key"
              : error.error === "key_disabled"
                ? "API key disabled"
                : "Could not start session"
        }
        detail={error.message}
      />
    );
  }

  if (ended) {
    return (
      <EmbedMessage
        icon={<WifiOff className="h-8 w-8 text-amber-400" />}
        title={ended.reason === "key_balance_exhausted" ? "API key balance exhausted" : "Session ended"}
        detail={
          ended.reason === "key_balance_exhausted"
            ? "The developer's API key ran out of balance. Top up the key's wallet to continue."
            : `Reason: ${ended.reason}`
        }
      />
    );
  }

  if (!session) {
    return (
      <EmbedMessage icon={<Loader2 className="h-8 w-8 animate-spin text-white/70" />} title="Starting game session…" />
    );
  }

  return (
    <div className="h-screen w-screen bg-black relative overflow-hidden">
      <video ref={videoRef} autoPlay playsInline className="h-full w-full object-contain bg-black" />
      {connectionState !== "connected" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <div className="flex flex-col items-center gap-2 text-white/80">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-sm">Connecting to {session.hostDisplayName}…</span>
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
