import { useEffect, useMemo, useState } from "react";
import {
  useGetHost,
  useUpdateHostConfig,
  useListGames,
  getGetHostQueryKey,
} from "@workspace/api-client-react";
import type { ScheduleSlot } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Save, Trash2, Calendar } from "lucide-react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60).toString().padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}
function hhmmToMinutes(s: string): number {
  const [h, m] = s.split(":").map((v) => Number(v));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return Math.max(0, Math.min(1440, h * 60 + m));
}

interface Props {
  hostToken: string;
}

export default function BindingForm({ hostToken }: Props) {
  const qc = useQueryClient();
  const { data: host, isLoading } = useGetHost(hostToken, {
    query: { enabled: !!hostToken, queryKey: getGetHostQueryKey(hostToken) },
  });
  const { data: games } = useListGames({});
  const update = useUpdateHostConfig();

  const [gameId, setGameId] = useState<string | null>(null);
  const [boundAppPath, setBoundAppPath] = useState("");
  const [boundAppLabel, setBoundAppLabel] = useState("");
  const [description, setDescription] = useState("");
  const [launchPriceUsd, setLaunchPriceUsd] = useState("0");
  const [minutePriceUsd, setMinutePriceUsd] = useState("0.04");
  const [scheduleMode, setScheduleMode] = useState<"always" | "scheduled">(
    "always",
  );
  const [scheduleJson, setScheduleJson] = useState<ScheduleSlot[]>([]);
  const [streamPlatform, setStreamPlatform] = useState("");
  const [streamUrl, setStreamUrl] = useState("");
  const [streamKey, setStreamKey] = useState("");
  const [clearStreamKey, setClearStreamKey] = useState(false);

  // Hydrate from server response, only on initial load.
  useEffect(() => {
    if (!host) return;
    setGameId(host.gameId);
    setBoundAppPath(host.boundAppPath ?? "");
    setBoundAppLabel(host.boundAppLabel ?? "");
    setDescription(host.description ?? "");
    setLaunchPriceUsd(String(host.launchPriceUsd ?? 0));
    setMinutePriceUsd(String(host.minutePriceUsd ?? 0));
    setScheduleMode(host.scheduleMode === "scheduled" ? "scheduled" : "always");
    setScheduleJson(host.scheduleJson ?? []);
    setStreamPlatform(host.streamPlatform ?? "");
    setStreamUrl(host.streamUrl ?? "");
    // Stream key is never returned — leave the input empty so submitting
    // without typing into it preserves the existing key.
  }, [host?.id]);

  const gameOptions = useMemo(
    () =>
      (games ?? [])
        .slice()
        .sort((a, b) => a.title.localeCompare(b.title))
        .map((g) => ({ value: g.id, label: g.title })),
    [games],
  );

  function addSlot() {
    setScheduleJson((prev) => [
      ...prev,
      { day: 1, startMin: 18 * 60, endMin: 23 * 60 },
    ]);
  }
  function updateSlot(idx: number, patch: Partial<ScheduleSlot>) {
    setScheduleJson((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    );
  }
  function removeSlot(idx: number) {
    setScheduleJson((prev) => prev.filter((_, i) => i !== idx));
  }

  function onSave() {
    const lp = Number(launchPriceUsd);
    const mp = Number(minutePriceUsd);
    if (!Number.isFinite(lp) || Math.abs(lp) > 100) {
      toast.error("Launch price must be a number with |value| ≤ 100");
      return;
    }
    if (!Number.isFinite(mp) || Math.abs(mp) > 100) {
      toast.error("Per-minute price must be a number with |value| ≤ 100");
      return;
    }
    if (scheduleMode === "scheduled") {
      for (const slot of scheduleJson) {
        // A slot must cover non-zero time. endMin < startMin means wrap-around
        // (until next day), which IS allowed. endMin === startMin is empty.
        if (slot.startMin === slot.endMin) {
          toast.error("Schedule slot has zero length");
          return;
        }
        if (slot.startMin < 0 || slot.startMin > 1439 ||
            slot.endMin < 0 || slot.endMin > 1439) {
          toast.error("Schedule slot times must be 00:00–23:59");
          return;
        }
      }
    }
    const body: Record<string, unknown> = {
      gameId,
      boundAppPath,
      boundAppLabel: boundAppLabel || boundAppPath.split(/[\\/]/).pop() || "",
      description,
      launchPriceUsd: lp,
      minutePriceUsd: mp,
      scheduleMode,
      scheduleJson,
      streamPlatform,
      streamUrl,
    };
    // Only send streamKey when the user typed something (an empty field
    // preserves the existing value). To explicitly remove the previously
    // saved key, the user toggles "Clear stream key" — we then send an empty
    // string, which the API treats as "wipe".
    if (clearStreamKey) {
      body.streamKey = "";
    } else if (streamKey.length > 0) {
      body.streamKey = streamKey;
    }

    update.mutate(
      { hostToken, data: body },
      {
        onSuccess: () => {
          toast.success("Host offer saved");
          setStreamKey(""); // don't keep the secret in memory
          setClearStreamKey(false);
          qc.invalidateQueries({ queryKey: getGetHostQueryKey(hostToken) });
        },
        onError: (err) => {
          const msg = (err as Error)?.message ?? "Failed to save";
          toast.error(msg);
        },
      },
    );
  }

  return (
    <Card
      className="bg-card/50 backdrop-blur border-primary/20"
      data-testid="card-binding-form"
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Game binding & pricing
        </CardTitle>
        <CardDescription>
          Bind this host to a specific game and the .exe the agent should
          launch when a player connects. Prices may be negative ("loss-leader"
          promos). Stream key is optional — set it to also restream the game
          window.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : (
          <>
            {/* Game + executable */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="game">Game from catalog</Label>
                <Select
                  value={gameId ?? "__none__"}
                  onValueChange={(v) => setGameId(v === "__none__" ? null : v)}
                >
                  <SelectTrigger id="game" data-testid="select-game">
                    <SelectValue placeholder="Pick a game" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Not bound —</SelectItem>
                    {gameOptions.map((g) => (
                      <SelectItem key={g.value} value={g.value}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="appLabel">Display label</Label>
                <Input
                  id="appLabel"
                  data-testid="input-app-label"
                  value={boundAppLabel}
                  onChange={(e) => setBoundAppLabel(e.target.value)}
                  placeholder="e.g. Cyberpunk2077.exe"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="appPath">Executable path on this PC</Label>
                <Input
                  id="appPath"
                  data-testid="input-app-path"
                  value={boundAppPath}
                  onChange={(e) => setBoundAppPath(e.target.value)}
                  placeholder="C:/Games/Cyberpunk 2077/bin/x64/Cyberpunk2077.exe"
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  The agent will run this file when a player joins.
                </p>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="desc">Description</Label>
                <Textarea
                  id="desc"
                  data-testid="input-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Hardware, mods, rules, vibe…"
                  maxLength={4000}
                />
              </div>
            </div>

            {/* Pricing */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="launchPrice">
                  Launch fee (USD, can be negative)
                </Label>
                <Input
                  id="launchPrice"
                  data-testid="input-launch-price"
                  type="number"
                  step="0.01"
                  value={launchPriceUsd}
                  onChange={(e) => setLaunchPriceUsd(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minutePrice">
                  Per-minute price (USD, can be negative)
                </Label>
                <Input
                  id="minutePrice"
                  data-testid="input-minute-price"
                  type="number"
                  step="0.01"
                  value={minutePriceUsd}
                  onChange={(e) => setMinutePriceUsd(e.target.value)}
                />
              </div>
            </div>

            {/* Schedule */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="schedMode">Availability schedule</Label>
                <Badge variant={scheduleMode === "always" ? "default" : "secondary"}>
                  {scheduleMode}
                </Badge>
              </div>
              <Select
                value={scheduleMode}
                onValueChange={(v) =>
                  setScheduleMode(v === "scheduled" ? "scheduled" : "always")
                }
              >
                <SelectTrigger id="schedMode" data-testid="select-schedule-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="always">
                    Always available while agent is running
                  </SelectItem>
                  <SelectItem value="scheduled">
                    Only inside the slots below
                  </SelectItem>
                </SelectContent>
              </Select>
              {scheduleMode === "scheduled" && (
                <div className="space-y-2 rounded border border-border/50 p-3 bg-background/40">
                  {scheduleJson.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No slots — host will appear offline. Add at least one.
                    </p>
                  )}
                  {scheduleJson.map((slot, i) => (
                    <div
                      key={i}
                      className="flex flex-wrap items-end gap-2"
                      data-testid={`schedule-slot-${i}`}
                    >
                      <div className="space-y-1">
                        <Label className="text-xs">Day (UTC)</Label>
                        <Select
                          value={String(slot.day)}
                          onValueChange={(v) =>
                            updateSlot(i, { day: Number(v) })
                          }
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DAYS.map((d, idx) => (
                              <SelectItem key={d} value={String(idx)}>
                                {d}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">From</Label>
                        <Input
                          type="time"
                          value={minutesToHHMM(slot.startMin)}
                          onChange={(e) =>
                            updateSlot(i, {
                              startMin: hhmmToMinutes(e.target.value),
                            })
                          }
                          className="w-28"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">To</Label>
                        <Input
                          type="time"
                          value={minutesToHHMM(slot.endMin)}
                          onChange={(e) =>
                            updateSlot(i, {
                              endMin: hhmmToMinutes(e.target.value),
                            })
                          }
                          className="w-28"
                        />
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeSlot(i)}
                        data-testid={`button-remove-slot-${i}`}
                        aria-label="Remove slot"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addSlot}
                    data-testid="button-add-slot"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add slot
                  </Button>
                </div>
              )}
            </div>

            {/* Restream */}
            <div className="space-y-3">
              <Label className="text-base">
                Restream (optional)
                {host?.streamKeySet && (
                  <Badge variant="outline" className="ml-2">
                    key set
                  </Badge>
                )}
              </Label>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="sp" className="text-xs">
                    Platform
                  </Label>
                  <Input
                    id="sp"
                    data-testid="input-stream-platform"
                    value={streamPlatform}
                    onChange={(e) => setStreamPlatform(e.target.value)}
                    placeholder="twitch / youtube / rtmp"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="su" className="text-xs">
                    Ingest URL
                  </Label>
                  <Input
                    id="su"
                    data-testid="input-stream-url"
                    value={streamUrl}
                    onChange={(e) => setStreamUrl(e.target.value)}
                    placeholder="rtmp://live.twitch.tv/app"
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-1 md:col-span-3">
                  <Label htmlFor="sk" className="text-xs">
                    Stream key (leave empty to keep existing)
                  </Label>
                  <Input
                    id="sk"
                    data-testid="input-stream-key"
                    type="password"
                    value={streamKey}
                    onChange={(e) => {
                      setStreamKey(e.target.value);
                      if (e.target.value.length > 0) setClearStreamKey(false);
                    }}
                    placeholder="••••••••"
                    disabled={clearStreamKey}
                  />
                  {host?.streamKeySet && (
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        data-testid="checkbox-clear-stream-key"
                        checked={clearStreamKey}
                        onChange={(e) => {
                          setClearStreamKey(e.target.checked);
                          if (e.target.checked) setStreamKey("");
                        }}
                      />
                      Clear the saved stream key on next save
                    </label>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={onSave}
                disabled={update.isPending}
                data-testid="button-save-binding"
              >
                <Save className="h-4 w-4 mr-2" />
                {update.isPending ? "Saving…" : "Save offer"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
