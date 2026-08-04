import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { formatApiError } from "@/lib/api-errors";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  GripVertical,
  Plus,
  Pencil,
  Trash2,
  Gamepad2,
  Globe,
  Monitor,
  Search,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  useListHostLibrary,
  useAddHostLibraryEntry,
  useUpdateHostLibraryEntry,
  useRemoveHostLibraryEntry,
  useListGames,
  getListHostLibraryQueryKey,
  getListGamesQueryKey,
  rawgSearch,
  steamLookup,
  submitGame,
  patchSubmissionPendingConfig,
  type HostLibraryEntry,
  type RawgSearchResultItem,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const cardStyle = {
  background: "#0a1018",
  border: "1px solid rgba(255,255,255,0.06)",
};

const inputStyle = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#e2e8f0",
};

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------
interface CatalogGame {
  id: string;
  slug: string;
  title: string;
  coverImageUrl?: string | null;
  description?: string | null;
  genre?: string | null;
  category?: string | null;
  genres?: string[] | null;
  steamAppId?: string | null;
  isMultiplayer?: boolean;
  browserHostUrl?: string | null;
}

type LibraryEntry = HostLibraryEntry;

function entryKind(e: LibraryEntry): "native" | "browser" {
  return e.boundUrl || e.game.browserHostUrl ? "browser" : "native";
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------
const LZT_PER_USD = 200;

function lztToUsd(lzt: number) {
  return (lzt / LZT_PER_USD).toFixed(2);
}

function LztBadge({ lzt, className = "" }: { lzt: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 font-mono ${className}`}>
      <span
        title="Доход хоста — зачисляется на баланс «К выводу»"
        className="inline-block w-2 h-2 rounded-full"
        style={{ background: "#34d399" }}
      />
      <span
        title="Игровой баланс"
        className="inline-block w-2 h-2 rounded-full -ml-0.5"
        style={{ background: "#38bdf8" }}
      />
      <span className="text-emerald-300 font-bold">{lzt.toLocaleString("ru-RU")}</span>
      <span className="text-slate-500 text-xs">LZT</span>
      <span className="text-slate-600 text-xs">≈${lztToUsd(lzt)}</span>
    </span>
  );
}

function isWindowsPath(s: string) {
  return /^[a-zA-Z]:\\/.test(s) || s.startsWith("\\\\") || s.startsWith("/");
}

// --------------------------------------------------------------------------
// Sortable row
// --------------------------------------------------------------------------
function SortableRow({
  entry,
  hasActiveSession,
  onToggle,
  onEdit,
  onDelete,
  toggling,
}: {
  entry: LibraryEntry;
  hasActiveSession: boolean;
  onToggle: (e: LibraryEntry) => void;
  onEdit: (e: LibraryEntry) => void;
  onDelete: (e: LibraryEntry) => void;
  toggling: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: entry.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const isBrowser = entryKind(entry) === "browser";

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        background: isDragging ? "rgba(14,165,233,0.08)" : undefined,
        border: isDragging ? "1px solid rgba(14,165,233,0.25)" : undefined,
      }}
      className="flex items-center gap-3 px-3 py-3 rounded-lg"
    >
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing flex-shrink-0"
        title="Перетащи для изменения порядка"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Cover */}
      <div
        className="w-9 h-9 rounded flex-shrink-0 flex items-center justify-center overflow-hidden"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        {entry.game.coverImageUrl ? (
          <img src={entry.game.coverImageUrl} alt="" className="w-full h-full object-cover rounded" />
        ) : (
          <Gamepad2 className="h-4 w-4 text-slate-600" />
        )}
      </div>

      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-white text-sm truncate">{entry.game.title}</span>
          <Badge
            variant="outline"
            className="text-[10px] h-4 px-1.5 flex-shrink-0"
            style={{
              background: isBrowser ? "rgba(16,185,129,0.12)" : "rgba(14,165,233,0.12)",
              color: isBrowser ? "#34d399" : "#38bdf8",
              border: isBrowser ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(14,165,233,0.3)",
            }}
          >
            {isBrowser ? <Globe className="h-2.5 w-2.5 mr-0.5" /> : <Monitor className="h-2.5 w-2.5 mr-0.5" />}
            {isBrowser ? "браузер" : "нативная"}
          </Badge>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <LztBadge lzt={entry.pricePerMinuteLzt} className="text-xs" />
          {!entry.enabled && (
            <span className="text-[10px] text-slate-600 italic">выключена</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Switch
                checked={entry.enabled}
                disabled={toggling}
                onCheckedChange={() => onToggle(entry)}
                className="data-[state=checked]:bg-sky-500"
              />
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {entry.enabled ? "Выключить игру" : "Включить игру"}
          </TooltipContent>
        </Tooltip>

        {/* Edit */}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-slate-400 hover:text-white"
          onClick={() => onEdit(entry)}
          title="Редактировать"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>

        {/* Delete */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-slate-500 hover:text-red-400"
                onClick={() => !hasActiveSession && onDelete(entry)}
                disabled={hasActiveSession}
                title={hasActiveSession ? "Есть активная сессия" : "Удалить"}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </span>
          </TooltipTrigger>
          {hasActiveSession && (
            <TooltipContent>Нельзя удалить: идёт активная сессия</TooltipContent>
          )}
        </Tooltip>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Catalog search step (inside Add modal)
// --------------------------------------------------------------------------
function CatalogSearch({
  onSelect,
  onSuggestNew,
}: {
  onSelect: (g: CatalogGame) => void;
  onSuggestNew: () => void;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => setDebouncedQuery(query), 300);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query]);

  const listParams = useMemo(
    () => ({ search: debouncedQuery.trim() || undefined }),
    [debouncedQuery],
  );
  const { data: games, isLoading: loading } = useListGames(listParams, {
    query: {
      queryKey: getListGamesQueryKey(listParams),
    },
  });
  const results = (games ?? []) as CatalogGame[];

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
        <Input
          placeholder="Поиск игры в каталоге…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
          style={inputStyle}
          autoFocus
        />
      </div>

      <div
        className="rounded-lg overflow-y-auto space-y-1"
        style={{ maxHeight: "340px", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        {loading && (
          <div className="flex items-center justify-center py-6 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Поиск…
          </div>
        )}
        {!loading && results.length === 0 && (
          <div className="py-8 text-center text-slate-500 text-sm">
            Ничего не найдено по «{query}»
          </div>
        )}
        {!loading &&
          results.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => onSelect(g)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/5 transition-colors"
            >
              <div
                className="w-9 h-9 rounded flex-shrink-0 flex items-center justify-center overflow-hidden"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                {g.coverImageUrl ? (
                  <img src={g.coverImageUrl} alt="" className="w-full h-full object-cover rounded" />
                ) : (
                  <ImageIcon className="h-4 w-4 text-slate-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">{g.title}</div>
                <div className="text-[11px] text-slate-500 truncate">
                  {[g.category, g.genre, g.genres?.join(", ")].filter(Boolean).join(" · ") || "Без категории"}
                </div>
              </div>
              {g.browserHostUrl && (
                <Badge
                  variant="outline"
                  className="text-[10px] h-4 flex-shrink-0"
                  style={{ color: "#34d399", border: "1px solid rgba(16,185,129,0.3)" }}
                >
                  браузер
                </Badge>
              )}
            </button>
          ))}
      </div>

      <div className="pt-1 border-t border-white/5 flex items-center justify-between">
        <p className="text-xs text-slate-500">Нет нужной игры?</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="text-xs border-white/10 text-slate-300 hover:text-white"
          onClick={onSuggestNew}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Предложить новую
        </Button>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Config form (path/url/price after selecting a catalog game)
// --------------------------------------------------------------------------
function LibraryConfigForm({
  game,
  onSubmit,
  onBack,
  submitting,
  isPending = false,
}: {
  game: CatalogGame;
  onSubmit: (v: { pricePerMinuteLzt: number; appPath: string; boundUrl: string; launchArgs: string }) => void;
  onBack: () => void;
  submitting: boolean;
  isPending?: boolean;
}) {
  const isBrowser = !!(game.browserHostUrl);
  const [price, setPrice] = useState("8");
  const [appPath, setAppPath] = useState("");
  const [boundUrl, setBoundUrl] = useState(game.browserHostUrl ?? "");
  const [launchArgs, setLaunchArgs] = useState("");
  const [pathErr, setPathErr] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBrowser && appPath.trim() && !isWindowsPath(appPath.trim())) {
      setPathErr("Путь должен выглядеть как C:\\path\\to\\game.exe или /path/to/binary");
      return;
    }
    setPathErr("");
    onSubmit({
      pricePerMinuteLzt: Math.max(0, parseInt(price, 10) || 0),
      appPath: isBrowser ? "" : appPath.trim(),
      boundUrl: isBrowser ? boundUrl.trim() : "",
      launchArgs: launchArgs.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white mb-1">
        <ArrowLeft className="h-3.5 w-3.5" />
        Назад к поиску
      </button>

      <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="w-10 h-10 rounded flex-shrink-0 overflow-hidden flex items-center justify-center" style={{ background: "rgba(255,255,255,0.04)" }}>
          {game.coverImageUrl ? (
            <img src={game.coverImageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <Gamepad2 className="h-5 w-5 text-slate-600" />
          )}
        </div>
        <div>
          <div className="font-semibold text-white text-sm">{game.title}</div>
          <div className="text-[11px] text-slate-500">{game.category ?? game.genre ?? "Каталог"}</div>
        </div>
      </div>

      {/* Price */}
      <div className="space-y-1.5">
        <Label className="text-slate-300 text-sm">
          Цена за минуту (LZT)
          <span className="ml-2 text-emerald-400/80 font-normal text-xs">
            зачисляется на «К выводу»
          </span>
        </Label>
        <div className="flex items-center gap-3">
          <Input
            type="number"
            min={0}
            max={200000}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-32"
            style={inputStyle}
          />
          <span className="text-xs text-slate-500">
            ≈ ${lztToUsd(parseInt(price, 10) || 0)} / мин
          </span>
        </div>
        <p className="text-[11px] text-slate-500">200 LZT = 1 USDT. Рекомендуется: 5–20 LZT/мин.</p>
      </div>

      {isBrowser ? (
        <div className="space-y-1.5">
          <Label className="text-slate-300 text-sm">URL браузерной игры</Label>
          <Input
            placeholder="https://example.com/game"
            value={boundUrl}
            onChange={(e) => setBoundUrl(e.target.value)}
            style={inputStyle}
          />
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">Путь к .exe (Windows)</Label>
            <Input
              placeholder="C:\Games\MyGame\game.exe"
              value={appPath}
              onChange={(e) => { setAppPath(e.target.value); setPathErr(""); }}
              style={inputStyle}
              className="font-mono"
            />
            {pathErr && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" /> {pathErr}
              </p>
            )}
            <p className="text-[11px] text-slate-500">
              Реальная проверка существования файла — на стороне агента хоста.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">Аргументы запуска <span className="text-slate-500 font-normal">(опционально)</span></Label>
            <Input
              placeholder="-window-mode borderless"
              value={launchArgs}
              onChange={(e) => setLaunchArgs(e.target.value)}
              style={inputStyle}
              className="font-mono"
            />
          </div>
        </>
      )}

      <div className="flex justify-end pt-1">
        <Button
          type="submit"
          disabled={submitting}
          className="font-bold"
          style={{ background: "#0ea5e9", color: "#fff" }}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          {isPending ? "Сохранить настройки" : "Добавить в библиотеку"}
        </Button>
      </div>
    </form>
  );
}

// --------------------------------------------------------------------------
// New game submission form (suggest new to moderators)
// --------------------------------------------------------------------------
function SubmitGameForm({
  hostToken,
  onBack,
  onSubmitted,
}: {
  hostToken: string;
  onBack: () => void;
  onSubmitted: (submissionId: string, game: CatalogGame) => void;
}) {
  const [title, setTitle] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [steamId, setSteamId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // RAWG autocomplete state
  const [rawgSuggestions, setRawgSuggestions] = useState<RawgSearchResultItem[]>([]);
  const [rawgLoading, setRawgLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const rawgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Steam auto-fill state
  const [steamLoading, setSteamLoading] = useState(false);

  // Debounced RAWG search as user types title
  const handleTitleChange = (value: string) => {
    setTitle(value);
    setShowSuggestions(true);
    if (rawgTimerRef.current) clearTimeout(rawgTimerRef.current);
    if (value.trim().length < 3) {
      setRawgSuggestions([]);
      return;
    }
    rawgTimerRef.current = setTimeout(async () => {
      setRawgLoading(true);
      try {
        const data = await rawgSearch({ q: value.trim() });
        setRawgSuggestions(data);
      } catch {
        setRawgSuggestions([]);
      } finally {
        setRawgLoading(false);
      }
    }, 400);
  };

  // Fill form fields from a RAWG/Steam suggestion
  const applyRawgSuggestion = (s: RawgSearchResultItem) => {
    setTitle(s.title);
    if (s.coverImageUrl) setCoverUrl(s.coverImageUrl);
    if (s.genres.length) setCategory(s.genres.join(", "));
    if (s.steamAppId) setSteamId(s.steamAppId);
    setRawgSuggestions([]);
    setShowSuggestions(false);
  };

  // Fetch Steam metadata by App ID and auto-fill form
  const fetchSteamData = async () => {
    const id = steamId.trim();
    if (!id || !/^\d+$/.test(id)) {
      toast.error("Введи числовой Steam App ID");
      return;
    }
    setSteamLoading(true);
    try {
      const d = await steamLookup({ appId: id });
      setTitle(d.title);
      if (d.coverImageUrl) setCoverUrl(d.coverImageUrl);
      if (d.description) setDescription(d.description);
      if (d.genres?.length) setCategory(d.genres.join(", "));
      toast.success(
        `Заполнено из Steam: ${d.title}${d.currentPlayers ? ` · ${d.currentPlayers.toLocaleString()} играют` : ""}`,
      );
    } catch {
      toast.error("Игра не найдена в Steam");
    } finally {
      setSteamLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const r = await submitGame({
        hostToken,
        title: title.trim(),
        coverImageUrl: coverUrl.trim() || undefined,
        category: category.trim() || undefined,
        description: description.trim() || undefined,
        steamAppId: steamId.trim() || undefined,
        kind: "native",
      });
      const placeholder: CatalogGame = {
        id: r.id,
        slug: r.slug,
        title: r.title,
        coverImageUrl: coverUrl.trim() || null,
        category: category.trim() || null,
      };
      onSubmitted(r.id, placeholder);
    } catch (err) {
      toast.error(formatApiError(err, "Не удалось отправить заявку"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white mb-1">
        <ArrowLeft className="h-3.5 w-3.5" />
        Назад к поиску
      </button>

      <div>
        <h3 className="font-semibold text-white mb-0.5">Предложить новую игру</h3>
        <p className="text-xs text-slate-500">Заявка уйдёт на модерацию. После одобрения игра появится в каталоге.</p>
      </div>

      {/* Title with RAWG autocomplete */}
      <div className="space-y-1.5 relative">
        <Label className="text-slate-300 text-sm">Название *</Label>
        <div className="relative">
          <Input
            placeholder="Grand Theft Auto VI"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            style={inputStyle}
            autoFocus
            required
          />
          {rawgLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-slate-500" />
          )}
        </div>

        {/* RAWG suggestions dropdown */}
        {showSuggestions && rawgSuggestions.length > 0 && (
          <div
            className="absolute z-50 w-full mt-1 rounded-lg overflow-hidden shadow-2xl"
            style={{ background: "#0d1623", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            {rawgSuggestions.map((s) => (
              <button
                key={s.rawgId}
                type="button"
                onMouseDown={() => applyRawgSuggestion(s)}
                className="flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-white/5 transition-colors"
              >
                {s.coverImageUrl ? (
                  <img
                    src={s.coverImageUrl}
                    alt={s.title}
                    className="w-10 h-10 rounded object-cover flex-shrink-0"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <div className="w-10 h-10 rounded bg-slate-800 flex items-center justify-center flex-shrink-0">
                    <Gamepad2 className="h-4 w-4 text-slate-600" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{s.title}</p>
                  {s.genres.length > 0 && (
                    <p className="text-[10px] text-slate-500 truncate">{s.genres.slice(0, 3).join(" · ")}</p>
                  )}
                </div>
                {s.rating != null && s.rating > 0 && (
                  <span className="ml-auto text-[10px] font-mono text-sky-400 flex-shrink-0">★ {s.rating.toFixed(1)}</span>
                )}
              </button>
            ))}
            <div className="px-3 py-1.5 border-t border-white/5">
              <span className="text-[10px] text-slate-600">Данные: RAWG.io</span>
            </div>
          </div>
        )}
      </div>

      {/* Cover URL with preview */}
      <div className="space-y-1.5">
        <Label className="text-slate-300 text-sm">URL обложки</Label>
        <div className="flex gap-2 items-start">
          <Input placeholder="https://…/cover.jpg" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} style={inputStyle} />
          {coverUrl && (
            <img
              src={coverUrl}
              alt="cover"
              className="w-10 h-10 rounded object-cover flex-shrink-0"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-slate-300 text-sm">Категория / жанры</Label>
        <Input placeholder="Action, RPG, Strategy…" value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle} />
      </div>

      {/* Steam App ID with auto-fill button */}
      <div className="space-y-1.5">
        <Label className="text-slate-300 text-sm">
          Steam App ID{" "}
          <span className="text-slate-500 font-normal">(заполнит форму автоматически)</span>
        </Label>
        <div className="flex gap-2">
          <Input
            placeholder="730"
            value={steamId}
            onChange={(e) => setSteamId(e.target.value)}
            style={inputStyle}
            className="font-mono"
          />
          <Button
            type="button"
            onClick={fetchSteamData}
            disabled={steamLoading || !steamId.trim()}
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0" }}
            className="flex-shrink-0 text-xs px-3"
          >
            {steamLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Заполнить"}
          </Button>
        </div>
        <p className="text-[10px] text-slate-600">Найди ID на странице игры в Steam: store.steampowered.com/app/<strong>730</strong>/</p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-slate-300 text-sm">Краткое описание <span className="text-slate-500 font-normal">(опционально)</span></Label>
        <textarea
          rows={3}
          placeholder="Краткое описание игры для модератора…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 rounded-md text-sm resize-none"
          style={{ ...inputStyle, outline: "none" }}
        />
      </div>

      <div className="flex justify-end pt-1">
        <Button type="submit" disabled={submitting || !title.trim()} className="font-bold" style={{ background: "#0ea5e9", color: "#fff" }}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Отправить заявку
        </Button>
      </div>
    </form>
  );
}

// --------------------------------------------------------------------------
// Edit modal
// --------------------------------------------------------------------------
function EditModal({
  entry,
  open,
  onClose,
  onSave,
}: {
  entry: LibraryEntry | null;
  open: boolean;
  onClose: () => void;
  onSave: (gameId: string, v: { pricePerMinuteLzt: number; appPath: string; boundUrl: string; launchArgs: string }) => Promise<void>;
}) {
  const [price, setPrice] = useState("0");
  const [appPath, setAppPath] = useState("");
  const [boundUrl, setBoundUrl] = useState("");
  const [launchArgs, setLaunchArgs] = useState("");
  const [saving, setSaving] = useState(false);
  const [pathErr, setPathErr] = useState("");

  useEffect(() => {
    if (entry) {
      setPrice(String(entry.pricePerMinuteLzt));
      setAppPath(entry.appPath);
      setBoundUrl(entry.boundUrl);
      setLaunchArgs(entry.launchArgs);
      setPathErr("");
    }
  }, [entry]);

  if (!entry) return null;
  const isBrowser = entryKind(entry) === "browser";

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBrowser && appPath.trim() && !isWindowsPath(appPath.trim())) {
      setPathErr("Путь должен выглядеть как C:\\path\\to\\game.exe");
      return;
    }
    setSaving(true);
    await onSave(entry.gameId, {
      pricePerMinuteLzt: Math.max(0, parseInt(price, 10) || 0),
      appPath: isBrowser ? "" : appPath.trim(),
      boundUrl: isBrowser ? boundUrl.trim() : "",
      launchArgs: launchArgs.trim(),
    });
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md" style={{ background: "#0d1520", border: "1px solid rgba(255,255,255,0.08)" }}>
        <DialogHeader>
          <DialogTitle className="text-white">Редактировать: {entry.game.title}</DialogTitle>
          <DialogDescription className="text-slate-500">Измени настройки запуска и цену.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">Цена за минуту (LZT)</Label>
            <div className="flex items-center gap-3">
              <Input type="number" min={0} max={200000} value={price} onChange={(e) => setPrice(e.target.value)} className="w-32" style={inputStyle} />
              <span className="text-xs text-slate-500">≈ ${lztToUsd(parseInt(price, 10) || 0)} / мин</span>
            </div>
          </div>
          {isBrowser ? (
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">URL браузерной игры</Label>
              <Input value={boundUrl} onChange={(e) => setBoundUrl(e.target.value)} style={inputStyle} />
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm">Путь к .exe</Label>
                <Input value={appPath} onChange={(e) => { setAppPath(e.target.value); setPathErr(""); }} style={inputStyle} className="font-mono" />
                {pathErr && <p className="text-xs text-red-400">{pathErr}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm">Аргументы <span className="text-slate-500 font-normal">(опционально)</span></Label>
                <Input value={launchArgs} onChange={(e) => setLaunchArgs(e.target.value)} style={inputStyle} className="font-mono" />
              </div>
            </>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="border-white/10 text-slate-300 hover:text-white">Отмена</Button>
            <Button type="submit" disabled={saving} style={{ background: "#0ea5e9", color: "#fff" }}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Сохранить
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --------------------------------------------------------------------------
// Delete confirmation modal
// --------------------------------------------------------------------------
function DeleteModal({
  entry,
  open,
  onClose,
  onConfirm,
}: {
  entry: LibraryEntry | null;
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);

  const handle = async () => {
    setDeleting(true);
    await onConfirm();
    setDeleting(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-sm" style={{ background: "#0d1520", border: "1px solid rgba(255,255,255,0.08)" }}>
        <DialogHeader>
          <DialogTitle className="text-white">Удалить игру?</DialogTitle>
          <DialogDescription className="text-slate-500">
            «{entry?.game.title}» будет удалена из твоей библиотеки. Это действие необратимо.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 mt-4">
          <Button type="button" variant="outline" onClick={onClose} className="border-white/10 text-slate-300 hover:text-white">Отмена</Button>
          <Button type="button" onClick={handle} disabled={deleting} style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>
            {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Удалить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --------------------------------------------------------------------------
// Add game modal  (search → config → or suggest)
// --------------------------------------------------------------------------
type AddStep = "search" | "config" | "suggest";

function AddGameModal({
  hostToken,
  open,
  onClose,
  onAdded,
}: {
  hostToken: string;
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [step, setStep] = useState<AddStep>("search");
  const [selectedGame, setSelectedGame] = useState<CatalogGame | null>(null);
  const [pendingSubmissionId, setPendingSubmissionId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const addEntry = useAddHostLibraryEntry();

  const handleClose = () => {
    setStep("search");
    setSelectedGame(null);
    setPendingSubmissionId(null);
    onClose();
  };

  const handleAdd = async (v: { pricePerMinuteLzt: number; appPath: string; boundUrl: string; launchArgs: string }) => {
    if (!selectedGame) return;
    setSubmitting(true);

    if (pendingSubmissionId) {
      // Pending submission: save config so the game auto-appears in library on approval.
      try {
        await patchSubmissionPendingConfig(pendingSubmissionId, { hostToken, ...v });
        toast.success(
          `Настройки сохранены. «${selectedGame.title}» появится в библиотеке после одобрения модератором.`,
        );
        handleClose();
      } catch (err) {
        toast.error(formatApiError(err, "Не удалось сохранить настройки"));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    try {
      await addEntry.mutateAsync({
        hostToken,
        data: { gameId: selectedGame.id, ...v },
      });
      toast.success(`«${selectedGame.title}» добавлена в библиотеку`);
      handleClose();
      onAdded();
    } catch (err) {
      toast.error(formatApiError(err, "Не удалось добавить игру"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitted = (submissionId: string, game: CatalogGame) => {
    setPendingSubmissionId(submissionId);
    setSelectedGame(game);
    setStep("config");
  };

  const titleMap: Record<AddStep, string> = {
    search: "Добавить игру в библиотеку",
    config: pendingSubmissionId ? "Настройка запуска (ожидает модерации)" : "Настройка запуска",
    suggest: "Предложить новую игру",
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-lg" style={{ background: "#0d1520", border: "1px solid rgba(255,255,255,0.08)" }}>
        <DialogHeader>
          <DialogTitle className="text-white">{titleMap[step]}</DialogTitle>
          {step === "config" && pendingSubmissionId && (
            <p className="text-xs text-amber-400/80 mt-1">
              Заявка отправлена на модерацию. Прописанный путь и цена сохранятся — игра автоматически появится в библиотеке после одобрения.
            </p>
          )}
        </DialogHeader>
        <div className="mt-2">
          {step === "search" && (
            <CatalogSearch
              onSelect={(g) => { setSelectedGame(g); setStep("config"); }}
              onSuggestNew={() => setStep("suggest")}
            />
          )}
          {step === "config" && selectedGame && (
            <LibraryConfigForm
              game={selectedGame}
              onSubmit={handleAdd}
              onBack={() => { setSelectedGame(null); setPendingSubmissionId(null); setStep("search"); }}
              submitting={submitting}
              isPending={!!pendingSubmissionId}
            />
          )}
          {step === "suggest" && (
            <SubmitGameForm
              hostToken={hostToken}
              onBack={() => setStep("search")}
              onSubmitted={handleSubmitted}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --------------------------------------------------------------------------
// Main page
// --------------------------------------------------------------------------
export default function HostLibrary() {
  const { hostToken } = useAuth();
  const queryClient = useQueryClient();
  const [localEntries, setLocalEntries] = useState<LibraryEntry[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<LibraryEntry | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<LibraryEntry | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const {
    data: remoteEntries,
    isLoading: loading,
    isError,
    refetch,
  } = useListHostLibrary(hostToken ?? "", {
    query: {
      enabled: !!hostToken,
      queryKey: getListHostLibraryQueryKey(hostToken ?? ""),
    },
  });

  const updateEntry = useUpdateHostLibraryEntry();
  const removeEntry = useRemoveHostLibraryEntry();

  const sortedRemote = useMemo(() => {
    if (!remoteEntries) return [];
    return [...remoteEntries].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [remoteEntries]);

  // Prefer optimistic local order while drag/reorder is in flight.
  const entries = localEntries ?? sortedRemote;

  useEffect(() => {
    setLocalEntries(null);
  }, [sortedRemote]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const invalidateLibrary = useCallback(() => {
    if (!hostToken) return;
    void queryClient.invalidateQueries({
      queryKey: getListHostLibraryQueryKey(hostToken),
    });
  }, [hostToken, queryClient]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !hostToken) return;

    const oldIndex = entries.findIndex((e) => e.id === active.id);
    const newIndex = entries.findIndex((e) => e.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const previous = entries;
    const reordered = arrayMove(entries, oldIndex, newIndex);
    setLocalEntries(reordered);

    try {
      await Promise.all(
        reordered.map((entry, idx) =>
          updateEntry.mutateAsync({
            hostToken,
            gameId: entry.gameId,
            data: { sortOrder: idx },
          }),
        ),
      );
      invalidateLibrary();
    } catch {
      setLocalEntries(previous);
      toast.error("Не удалось сохранить порядок — изменения отменены");
      void refetch();
    }
  };

  const handleToggle = async (entry: LibraryEntry) => {
    if (!hostToken) return;
    setToggling(entry.id);
    try {
      await updateEntry.mutateAsync({
        hostToken,
        gameId: entry.gameId,
        data: { enabled: !entry.enabled },
      });
      setLocalEntries((prev) => {
        const base = prev ?? entries;
        return base.map((e) =>
          e.id === entry.id ? { ...e, enabled: !e.enabled } : e,
        );
      });
      invalidateLibrary();
    } catch (err) {
      toast.error(formatApiError(err, "Не удалось переключить"));
    } finally {
      setToggling(null);
    }
  };

  const handleEdit = async (
    gameId: string,
    v: { pricePerMinuteLzt: number; appPath: string; boundUrl: string; launchArgs: string },
  ) => {
    if (!hostToken) return;
    try {
      await updateEntry.mutateAsync({ hostToken, gameId, data: v });
      toast.success("Сохранено");
      setEditEntry(null);
      invalidateLibrary();
    } catch (err) {
      toast.error(formatApiError(err, "Не удалось сохранить"));
    }
  };

  const handleDelete = async () => {
    if (!deleteEntry || !hostToken) return;
    try {
      await removeEntry.mutateAsync({
        hostToken,
        gameId: deleteEntry.gameId,
      });
      toast.success(`«${deleteEntry.game.title}» удалена из библиотеки`);
      setDeleteEntry(null);
      invalidateLibrary();
    } catch (err) {
      const status =
        err && typeof err === "object" && "status" in err
          ? (err as { status: number }).status
          : 0;
      if (status === 409) toast.error("Нельзя удалить: идёт активная сессия");
      else toast.error(formatApiError(err, "Не удалось удалить"));
    }
  };

  return (
    <div className="space-y-6 text-slate-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Моя библиотека</h1>
          <p className="text-sm text-slate-500">Игры, которые ты хостишь. Первая в списке — дефолтная при коннекте игрока.</p>
        </div>
        <Button
          onClick={() => setAddOpen(true)}
          className="font-bold gap-2"
          style={{ background: "#0ea5e9", color: "#fff" }}
          data-testid="button-add-game"
        >
          <Plus className="h-4 w-4" />
          Добавить игру
        </Button>
      </div>

      <Card style={cardStyle}>
        <CardHeader>
          <CardTitle className="text-base text-white flex items-center gap-2">
            <Gamepad2 className="h-4 w-4 text-sky-400" />
            Библиотека
            {!loading && entries.length > 0 && (
              <Badge variant="outline" className="text-[10px] ml-auto border-white/10 text-slate-400">
                {entries.length} игр
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="text-slate-500">
            Перетащи строки для изменения порядка отображения.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : isError ? (
            <div className="py-10 text-center space-y-3">
              <p className="text-sm text-slate-400">Не удалось загрузить библиотеку</p>
              <Button size="sm" variant="outline" onClick={() => void refetch()}>
                Повторить
              </Button>
            </div>
          ) : entries.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-14 text-center rounded-lg"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)" }}
            >
              <Gamepad2 className="h-16 w-16 text-slate-700 mb-4" />
              <p className="text-slate-300 font-semibold text-lg mb-1">Библиотека пуста</p>
              <p className="text-sm text-slate-500 mb-6 max-w-xs">
                Добавь первую игру из глобального каталога или предложи новую.
              </p>
              <Button
                onClick={() => setAddOpen(true)}
                className="font-bold gap-2"
                style={{ background: "#0ea5e9", color: "#fff" }}
              >
                <Plus className="h-4 w-4" />
                Добавить первую игру
              </Button>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={entries.map((e) => e.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1">
                  {entries.map((entry) => (
                    <SortableRow
                      key={entry.id}
                      entry={entry}
                      hasActiveSession={entry.hasActiveSession}
                      onToggle={handleToggle}
                      onEdit={setEditEntry}
                      onDelete={setDeleteEntry}
                      toggling={toggling === entry.id}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {/* Mobile hint */}
      {entries.length > 0 && (
        <p className="text-[11px] text-slate-600 text-center">
          Первая игра в списке будет выбрана по умолчанию, когда игрок подключается без явного выбора.
        </p>
      )}

      <AddGameModal
        hostToken={hostToken ?? ""}
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={invalidateLibrary}
      />
      <EditModal
        entry={editEntry}
        open={!!editEntry}
        onClose={() => setEditEntry(null)}
        onSave={handleEdit}
      />
      <DeleteModal
        entry={deleteEntry}
        open={!!deleteEntry}
        onClose={() => setDeleteEntry(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
