import { useState, useEffect, useRef, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { formatApiError } from "@/lib/api-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Gamepad2,
  Search,
  Loader2,
  ArrowLeft,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  useAddHostLibraryEntry,
  useListGames,
  useSubmitGame,
  usePatchSubmissionPendingConfig,
  getListGamesQueryKey,
  getListHostLibraryQueryKey,
  rawgSearch,
  steamLookup,
  type RawgSearchResultItem,
} from "@workspace/api-client-react";
import {
  lztToUsd,
  normalizeLibraryConfigValues,
  isValidSteamAppId,
  getAddModalTitle,
  buildCatalogSearchParams,
  formatCatalogGameMeta,
  isBrowserCatalogGame,
  type AddModalStep,
} from "./library-helpers";
import { ExePathPicker } from "./exe-path-picker";

const inputStyle = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#e2e8f0",
};

export interface CatalogGame {
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
    () => buildCatalogSearchParams(debouncedQuery),
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
                  {formatCatalogGameMeta(g.category, g.genre, g.genres)}
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
  const isBrowser = isBrowserCatalogGame(game);
  const [price, setPrice] = useState("8");
  const [appPath, setAppPath] = useState("");
  const [boundUrl, setBoundUrl] = useState(game.browserHostUrl ?? "");
  const [launchArgs, setLaunchArgs] = useState("");
  const [pathErr, setPathErr] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { values, pathError } = normalizeLibraryConfigValues({
      isBrowser,
      price,
      appPath,
      boundUrl,
      launchArgs,
    });
    if (pathError) {
      setPathErr(pathError);
      return;
    }
    setPathErr("");
    onSubmit(values);
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
          <ExePathPicker
            value={appPath}
            onChange={setAppPath}
            pathErr={pathErr || undefined}
            onClearError={() => setPathErr("")}
          />
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
  const submitGameMutation = useSubmitGame();
  const [submitting, setSubmitting] = useState(false);

  const [rawgSuggestions, setRawgSuggestions] = useState<RawgSearchResultItem[]>([]);
  const [rawgLoading, setRawgLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const rawgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [steamLoading, setSteamLoading] = useState(false);

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
        const results = await rawgSearch({ q: value.trim() });
        setRawgSuggestions(results);
      } catch {
        setRawgSuggestions([]);
      } finally {
        setRawgLoading(false);
      }
    }, 400);
  };

  const applyRawgSuggestion = (s: RawgSearchResultItem) => {
    setTitle(s.title);
    if (s.coverImageUrl) setCoverUrl(s.coverImageUrl);
    if (s.genres.length) setCategory(s.genres.join(", "));
    if (s.steamAppId) setSteamId(s.steamAppId);
    setRawgSuggestions([]);
    setShowSuggestions(false);
  };

  const fetchSteamData = async () => {
    const id = steamId.trim();
    if (!isValidSteamAppId(id)) {
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
      const data = await submitGameMutation.mutateAsync({
        data: {
          hostToken,
          title: title.trim(),
          coverImageUrl: coverUrl.trim() || undefined,
          category: category.trim() || undefined,
          description: description.trim() || undefined,
          steamAppId: steamId.trim() || undefined,
          kind: "native",
        },
      });
      const placeholder: CatalogGame = {
        id: data.id,
        slug: data.slug,
        title: data.title,
        coverImageUrl: coverUrl.trim() || null,
        category: category.trim() || null,
      };
      onSubmitted(data.id, placeholder);
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

export function AddGameModal({
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
  const [step, setStep] = useState<AddModalStep>("search");
  const [selectedGame, setSelectedGame] = useState<CatalogGame | null>(null);
  const [pendingSubmissionId, setPendingSubmissionId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const addEntry = useAddHostLibraryEntry();
  const patchPendingConfig = usePatchSubmissionPendingConfig();

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
      try {
        await patchPendingConfig.mutateAsync({
          id: pendingSubmissionId,
          data: { hostToken, ...v },
        });
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

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-lg" style={{ background: "#0d1520", border: "1px solid rgba(255,255,255,0.08)" }}>
        <DialogHeader>
          <DialogTitle className="text-white">{getAddModalTitle(step, pendingSubmissionId)}</DialogTitle>
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

/** Обёртка для онбординга на дашборде — открывает тот же AddGameModal, что и страница библиотеки. */
export function QuickAddFirstGame({ hostToken, guided = false }: { hostToken: string; guided?: boolean }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const invalidateLibrary = () => {
    void queryClient.invalidateQueries({
      queryKey: getListHostLibraryQueryKey(hostToken),
    });
  };

  return (
    <div
      className="rounded-lg p-3 space-y-3"
      style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.06)" }}
      data-testid="quick-add-first-game"
    >
      <p className="text-sm font-medium text-white">Первая игра</p>
      <p className="text-xs text-slate-400">
        Выбери игру из каталога, укажи путь к .exe и цену — как в полной библиотеке.
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          className="font-bold gap-2"
          style={{ background: "#0ea5e9", color: "#fff" }}
          onClick={() => setOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Добавить игру
        </Button>
        {!guided && (
          <Link href="/host/library" className="ml-auto text-xs text-sky-400 hover:underline">
            Полная библиотека →
          </Link>
        )}
      </div>
      <AddGameModal
        hostToken={hostToken}
        open={open}
        onClose={() => setOpen(false)}
        onAdded={invalidateLibrary}
      />
    </div>
  );
}
