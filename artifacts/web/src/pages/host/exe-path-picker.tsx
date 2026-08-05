import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, FolderOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  discoverAgentPort,
  fetchAgentSteamGames,
  requestAgentPickExe,
  type AgentSteamGame,
} from "@/lib/agent-local";

const inputStyle = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#e2e8f0",
};

type ExePathPickerProps = {
  value: string;
  onChange: (path: string) => void;
  pathErr?: string;
  onClearError?: () => void;
};

export function ExePathPicker({
  value,
  onChange,
  pathErr,
  onClearError,
}: ExePathPickerProps) {
  const [manualMode, setManualMode] = useState(false);
  const [agentOnline, setAgentOnline] = useState<boolean | null>(null);
  const [steamGames, setSteamGames] = useState<AgentSteamGame[]>([]);
  const [loadingSteam, setLoadingSteam] = useState(false);
  const [picking, setPicking] = useState(false);

  const loadAgentData = useCallback(async () => {
    const info = await discoverAgentPort({ force: true, timeoutMs: 900 });
    setAgentOnline(!!info);
    if (!info) {
      setSteamGames([]);
      return;
    }
    setLoadingSteam(true);
    try {
      const games = await fetchAgentSteamGames();
      setSteamGames(games.filter((g) => g.bestExePath));
    } finally {
      setLoadingSteam(false);
    }
  }, []);

  useEffect(() => {
    void loadAgentData();
  }, [loadAgentData]);

  const handlePickFile = async () => {
    setPicking(true);
    const picked = await requestAgentPickExe();
    setPicking(false);
    if (!picked) {
      if (!agentOnline) {
        toast.error("Агент не запущен на этом ПК — запусти агент или введи путь вручную");
      }
      return;
    }
    onChange(picked);
    onClearError?.();
    setManualMode(false);
  };

  const handleSteamPick = (game: AgentSteamGame) => {
    if (!game.bestExePath) return;
    onChange(game.bestExePath);
    onClearError?.();
    setManualMode(false);
  };

  const handleManualChange = (path: string) => {
    onChange(path);
    onClearError?.();
  };

  const steamWithExe = steamGames.slice(0, 12);

  return (
    <div className="space-y-2">
      <Label className="text-slate-300 text-sm">Путь к .exe (Windows)</Label>

      {!manualMode ? (
        <div className="flex gap-2">
          <Input
            readOnly
            value={value}
            placeholder="Выбери .exe через агент или из Steam ниже"
            style={inputStyle}
            className="font-mono flex-1"
            data-testid="exe-path-display"
          />
          <Button
            type="button"
            variant="outline"
            className="flex-shrink-0 border-white/10 text-slate-300 hover:text-white"
            onClick={() => void handlePickFile()}
            disabled={picking}
            data-testid="button-pick-exe"
          >
            {picking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FolderOpen className="h-4 w-4" />
            )}
            <span className="ml-1.5 hidden sm:inline">Обзор…</span>
          </Button>
        </div>
      ) : (
        <Input
          placeholder="C:\Games\MyGame\game.exe"
          value={value}
          onChange={(e) => handleManualChange(e.target.value)}
          style={inputStyle}
          className="font-mono"
          data-testid="exe-path-manual"
          autoFocus
        />
      )}

      {pathErr && (
        <p className="text-xs text-red-400 flex items-center gap-1">
          <AlertCircle className="h-3.5 w-3.5" /> {pathErr}
        </p>
      )}

      {agentOnline && (loadingSteam || steamWithExe.length > 0) && (
        <div className="space-y-1.5">
          <p className="text-[11px] text-slate-500">
            {loadingSteam ? "Сканируем Steam…" : "Или выбери из установленных игр Steam:"}
          </p>
          {!loadingSteam && (
            <div className="flex flex-wrap gap-1.5">
              {steamWithExe.map((game) => (
                <Button
                  key={game.appId}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-white/10 text-slate-300 hover:text-white max-w-full truncate"
                  onClick={() => handleSteamPick(game)}
                  title={game.bestExePath ?? undefined}
                  data-testid={`steam-exe-${game.appId}`}
                >
                  {game.name}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {agentOnline === false && (
        <p className="text-[11px] text-amber-400/80">
          Агент не обнаружен — запусти агент на этом ПК для выбора файла или сканирования Steam.
        </p>
      )}

      <button
        type="button"
        className="text-[11px] text-sky-400 hover:underline"
        onClick={() => setManualMode((v) => !v)}
        data-testid="toggle-manual-exe-path"
      >
        {manualMode ? "← Выбрать через агент" : "Ввести путь вручную"}
      </button>

      <p className="text-[11px] text-slate-500">
        Реальная проверка существования файла — на стороне агента хоста.
      </p>
    </div>
  );
}
