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
import { Gamepad2, AlertCircle, Loader2, Wifi, WifiOff, VolumeX, Wallet } from "lucide-react";
import { toast } from "sonner";
import { usePlayerWallet } from "@/hooks/use-player-wallet";

export default function Play() {
  const [, params] = useRoute("/play/:playerToken");
  const playerToken = params?.playerToken || "";

  const { data: session, isLoading, isError } = useGetSessionByPlayerToken(playerToken, {
    query: { enabled: !!playerToken, queryKey: getGetSessionByPlayerTokenQueryKey(playerToken) }
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

  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>("new");
  const [isPlaying, setIsPlaying] = useState(false);
  const [showAudioPrompt, setShowAudioPrompt] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const startedRef = useRef(false);

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
        toast.error("Connection lost");
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
      toast.error("Signaling server connection error");
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
        data: { playerWalletToken },
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

    type KeyInput = { type: "input"; kind: "key"; action: "down" | "up"; key: string };
    type MouseButtonInput = { type: "input"; kind: "mouse"; action: "down" | "up"; button: number };
    type MouseMoveInput = { type: "input"; kind: "mouse"; action: "move"; movementX: number; movementY: number };
    type InputEvent = KeyInput | MouseButtonInput | MouseMoveInput;

    const sendInput = (data: InputEvent) => {
      if (dcRef.current && dcRef.current.readyState === "open") {
        dcRef.current.send(JSON.stringify(data));
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      sendInput({ type: "input", kind: "key", action: "down", key: e.code });
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      sendInput({ type: "input", kind: "key", action: "up", key: e.code });
    };

    const handleMouseDown = (e: MouseEvent) => {
      sendInput({ type: "input", kind: "mouse", action: "down", button: e.button });
    };

    const handleMouseUp = (e: MouseEvent) => {
      sendInput({ type: "input", kind: "mouse", action: "up", button: e.button });
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === videoRef.current) {
        sendInput({
          type: "input",
          kind: "mouse",
          action: "move",
          movementX: e.movementX,
          movementY: e.movementY,
        });
      }
    };

    const handleWheel = (e: WheelEvent) => {
      // Only forward when the player has actually focused the stream (pointer
      // locked); otherwise we'd hijack normal page scrolling.
      if (document.pointerLockElement === videoRef.current) {
        e.preventDefault();
        sendInput({
          type: "input",
          kind: "wheel",
          deltaY: e.deltaY,
        } as unknown as InputEvent);
      }
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-destructive/50 bg-destructive/10">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <CardTitle>Session Not Found</CardTitle>
            <CardDescription>This share link is invalid or has expired.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!isPlaying) {
    const balance = wallet?.creditBalance ?? 0;
    const ratePerMin = session.ratePerMinute;
    const minutesAffordable =
      ratePerMin > 0 ? Math.floor(balance / ratePerMin) : 0;
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
        <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,rgba(0,255,170,0.1),transparent_50%)]" />
        <Card className="w-full max-w-md relative z-10 bg-card/80 backdrop-blur border-primary/20">
          <CardHeader className="text-center pb-6">
            <Gamepad2 className="h-16 w-16 text-primary mx-auto mb-6" />
            <CardTitle className="text-3xl font-bold tracking-tight mb-2">{session.appName}</CardTitle>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground font-mono">
              <Badge variant="outline">{session.resolution}</Badge>
              <Badge variant="outline">{session.bitrateKbps} kbps</Badge>
              <Badge variant="outline">${ratePerMin.toFixed(2)}/min</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-background/50 border border-border/50">
              <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Wallet className="h-4 w-4" /> Wallet Balance
              </div>
              <div className="text-right">
                <div className="font-bold font-mono">${balance.toFixed(2)}</div>
                <div className="text-[10px] text-muted-foreground">
                  ~{minutesAffordable} min playtime
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg bg-background/50 border border-border/50">
              <div className="text-sm font-medium text-muted-foreground">Host Status</div>
              <Badge variant={session.status === 'active' ? 'default' : 'secondary'}>
                {session.status.toUpperCase()}
              </Badge>
            </div>
            {claimError && (
              <div className="p-3 rounded-md bg-destructive/10 border border-destructive/40 text-sm text-destructive">
                {claimError}
              </div>
            )}
            {!playerWalletToken || claimSession.isPending ? (
              <Button className="w-full h-14 text-lg font-bold tracking-wider" disabled>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {playerWalletToken ? "Claiming session…" : "Setting up wallet…"}
              </Button>
            ) : balance < ratePerMin && !hasClaimed ? (
              <Link href="/wallet" className="block">
                <Button className="w-full h-14 text-lg font-bold tracking-wider">
                  Top Up Wallet
                </Button>
              </Link>
            ) : (
              <Button
                className="w-full h-14 text-lg font-bold tracking-wider"
                onClick={() => void startConnection()}
                disabled={session.status === 'ended'}
              >
                {session.status === 'ended' ? 'Session Ended' : 'CONNECT & PLAY'}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col relative overflow-hidden select-none">
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-50 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <div className="flex items-center gap-4">
          <div className="font-bold text-primary tracking-tight drop-shadow-md">STREAMLINE</div>
          <Badge variant="outline" className={`bg-black/50 backdrop-blur font-mono border-${connectionState === 'connected' ? 'primary' : 'destructive'} text-${connectionState === 'connected' ? 'primary' : 'destructive'}`}>
            {connectionState === 'connected' ? <Wifi className="w-3 h-3 mr-2 inline" /> : <WifiOff className="w-3 h-3 mr-2 inline" />}
            {connectionState.toUpperCase()}
          </Badge>
        </div>
        <Button variant="destructive" size="sm" onClick={cleanupConnection} className="pointer-events-auto shadow-md">
          Disconnect
        </Button>
      </div>

      <div className="flex-1 relative flex items-center justify-center bg-black cursor-crosshair">
        {connectionState !== 'connected' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-40 backdrop-blur-sm">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <div className="font-mono text-primary font-bold tracking-widest uppercase">
              Establishing WebRTC Connection
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
            <Button size="lg" onClick={handleEnableAudio} className="font-bold gap-2 shadow-xl hover:scale-105 transition-transform">
              <VolumeX className="h-5 w-5" />
              Click to Enable Audio
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
