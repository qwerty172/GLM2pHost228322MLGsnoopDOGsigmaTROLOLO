import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useCreateSession } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Gamepad2, Monitor, Zap, Loader2, Copy, CheckCircle2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

const PRESET_GAMES = [
  "Cyberpunk 2077",
  "Witcher 3",
  "Elden Ring",
  "Helldivers 2",
  "Microsoft Flight Simulator"
];

export default function SetupSession() {
  const { hostToken } = useAuth();
  const [appName, setAppName] = useState("");
  const [resolution, setResolution] = useState("1080p");
  const [bitrateKbps, setBitrateKbps] = useState<number[]>([8000]);
  const [createdSession, setCreatedSession] = useState<{
    appName: string;
    playerToken: string;
  } | null>(null);

  const createSession = useCreateSession();

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostToken || !appName.trim()) return;

    createSession.mutate(
      {
        data: {
          hostToken,
          appName,
          resolution,
          bitrateKbps: bitrateKbps[0],
        },
      },
      {
        onSuccess: (session) => {
          setCreatedSession({
            appName: session.appName,
            playerToken: session.playerToken,
          });
        },
        onError: () => {
          toast.error("Failed to create session");
        },
      },
    );
  };

  if (createdSession) {
    const shareLink = `${window.location.origin}${import.meta.env.BASE_URL}play/${createdSession.playerToken}`;
    const handleCopy = async () => {
      await navigator.clipboard.writeText(shareLink);
      toast.success("Share link copied");
    };
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card className="bg-card/50 backdrop-blur border-primary/30">
          <CardHeader className="text-center pb-4">
            <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-3" />
            <CardTitle className="text-2xl">Session ready</CardTitle>
            <CardDescription>
              Your stream for{" "}
              <span className="text-foreground font-semibold">
                {createdSession.appName}
              </span>{" "}
              is queued. Send the share link to your player to start streaming.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Player share link
              </Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={shareLink}
                  className="font-mono text-sm bg-background/60"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button type="button" onClick={handleCopy} className="gap-2">
                  <Copy className="h-4 w-4" />
                  Copy
                </Button>
              </div>
            </div>
          </CardContent>
          <CardFooter className="bg-muted/20 flex justify-between py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCreatedSession(null);
                setAppName("");
              }}
            >
              Start another
            </Button>
            <Link href="/host">
              <Button className="gap-2 font-bold uppercase tracking-wider">
                Open dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New Session</h1>
        <p className="text-muted-foreground">Configure a new game to stream from your hardware.</p>
      </div>

      <form onSubmit={handleCreate}>
        <Card className="bg-card/50 backdrop-blur border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gamepad2 className="h-5 w-5 text-primary" />
              Game Selection
            </CardTitle>
            <CardDescription>What game will you be hosting?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="appName">Game Name</Label>
              <Input
                id="appName"
                placeholder="e.g. Grand Theft Auto V"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                className="bg-background/50 font-medium"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Quick Presets</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_GAMES.map(game => (
                  <Button
                    key={game}
                    type="button"
                    variant="outline"
                    size="sm"
                    className={`rounded-full ${appName === game ? 'border-primary text-primary bg-primary/10' : ''}`}
                    onClick={() => setAppName(game)}
                  >
                    {game}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6 bg-card/50 backdrop-blur border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5 text-primary" />
              Stream Quality
            </CardTitle>
            <CardDescription>Configure the video encoding parameters.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="space-y-3">
              <Label>Target Resolution</Label>
              <RadioGroup value={resolution} onValueChange={setResolution} className="grid grid-cols-3 gap-4">
                {[
                  { id: "720p", label: "720p", desc: "60 FPS • Standard" },
                  { id: "1080p", label: "1080p", desc: "60 FPS • High" },
                  { id: "1440p", label: "1440p", desc: "60 FPS • Ultra" },
                ].map((res) => (
                  <div key={res.id}>
                    <RadioGroupItem value={res.id} id={res.id} className="peer sr-only" />
                    <Label
                      htmlFor={res.id}
                      className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all"
                    >
                      <span className="text-xl font-bold font-mono">{res.label}</span>
                      <span className="text-xs text-muted-foreground mt-1">{res.desc}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Video Bitrate</Label>
                <span className="font-mono font-bold text-primary">{bitrateKbps[0]} kbps</span>
              </div>
              <Slider
                value={bitrateKbps}
                onValueChange={setBitrateKbps}
                max={15000}
                min={3000}
                step={500}
                className="py-4"
              />
              <div className="flex justify-between text-xs text-muted-foreground font-mono">
                <span>3000 (Low)</span>
                <span>15000 (Max)</span>
              </div>
            </div>
          </CardContent>
          <CardFooter className="bg-muted/20 flex justify-end py-4">
            <Button 
              type="submit" 
              size="lg" 
              disabled={createSession.isPending || !appName.trim()}
              className="font-bold uppercase tracking-wider"
            >
              {createSession.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
              Initialize Stream
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
