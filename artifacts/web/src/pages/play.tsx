import { useEffect, useRef, useState } from "react";
import { useRoute } from "wouter";
import { useGetSessionByPlayerToken } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gamepad2, AlertCircle, Loader2, Wifi, WifiOff, VolumeX } from "lucide-react";
import { toast } from "sonner";

export default function Play() {
  const [, params] = useRoute("/play/:playerToken");
  const playerToken = params?.playerToken || "";

  const { data: session, isLoading, isError } = useGetSessionByPlayerToken(playerToken, {
    query: { enabled: !!playerToken }
  });

  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>("new");
  const [isPlaying, setIsPlaying] = useState(false);
  const [showAudioPrompt, setShowAudioPrompt] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);

  useEffect(() => {
    return () => {
      cleanupConnection();
    };
  }, []);

  const cleanupConnection = () => {
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
    setIsPlaying(false);
    setConnectionState("closed");
  };

  const startConnection = async () => {
    if (!playerToken) return;

    setIsPlaying(true);
    setConnectionState("connecting");

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProtocol}//${window.location.host}${import.meta.env.BASE_URL}api/signal?role=player&playerToken=${playerToken}`;
    
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
  };

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

    const sendInput = (data: any) => {
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
          movementY: e.movementY 
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("mousemove", handleMouseMove);
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
        <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,rgba(0,255,170,0.1),transparent_50%)]" />
        <Card className="w-full max-w-md relative z-10 bg-card/80 backdrop-blur border-primary/20">
          <CardHeader className="text-center pb-8">
            <Gamepad2 className="h-16 w-16 text-primary mx-auto mb-6" />
            <CardTitle className="text-3xl font-bold tracking-tight mb-2">{session.appName}</CardTitle>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground font-mono">
              <Badge variant="outline">{session.resolution}</Badge>
              <Badge variant="outline">{session.bitrateKbps} kbps</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-lg bg-background/50 border border-border/50">
              <div className="text-sm font-medium text-muted-foreground">Host Status</div>
              <Badge variant={session.status === 'active' ? 'default' : 'secondary'}>
                {session.status.toUpperCase()}
              </Badge>
            </div>
            <Button 
              className="w-full h-14 text-lg font-bold tracking-wider" 
              onClick={startConnection}
              disabled={session.status === 'ended'}
            >
              {session.status === 'ended' ? 'Session Ended' : 'CONNECT & PLAY'}
            </Button>
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
