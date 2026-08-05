import { Activity, SlidersHorizontal } from "lucide-react";
import { formatGenreLabel } from "@/lib/genre-names";

export type GamesFilterKey =
  | "hasMods"
  | "isMultiplayer"
  | "hostSpectatesPlayer"
  | "hasQuests"
  | "liveOnly";

export const GAMES_BOOL_FILTERS: { key: GamesFilterKey; label: string }[] = [
  { key: "isMultiplayer", label: "Мультиплеер" },
  { key: "hasMods", label: "С модами" },
  { key: "hostSpectatesPlayer", label: "Хост наблюдает" },
  { key: "hasQuests", label: "С квестами" },
];

type GamesFiltersPanelProps = {
  liveOnly: boolean;
  onLiveOnlyChange: (v: boolean) => void;
  category: string;
  onCategoryChange: (cat: string) => void;
  categories: string[];
  boolFilters: Record<GamesFilterKey, boolean>;
  onToggleBool: (key: GamesFilterKey) => void;
  allGenres: string[];
  selectedGenres: string[];
  onToggleGenre: (genre: string) => void;
  maxLzt: number;
  globalMaxLzt: number;
  onMaxLztChange: (v: number) => void;
  /** В шите — без внешних отступов сайдбара */
  variant?: "sidebar" | "sheet";
};

export function GamesFiltersPanel({
  liveOnly,
  onLiveOnlyChange,
  category,
  onCategoryChange,
  categories,
  boolFilters,
  onToggleBool,
  allGenres,
  selectedGenres,
  onToggleGenre,
  maxLzt,
  globalMaxLzt,
  onMaxLztChange,
  variant = "sidebar",
}: GamesFiltersPanelProps) {
  const wrapClass =
    variant === "sidebar"
      ? "hidden lg:flex flex-col gap-5 w-52 shrink-0 pt-1"
      : "flex flex-col gap-5";

  return (
    <div className={wrapClass} data-testid="games-filters-panel">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-2 font-mono flex items-center gap-1">
          <SlidersHorizontal className="h-3 w-3" /> Только онлайн
        </div>
        <button
          type="button"
          onClick={() => onLiveOnlyChange(!liveOnly)}
          className="w-full h-8 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 px-3"
          style={{
            background: liveOnly ? "rgba(45,212,191,0.15)" : "rgba(255,255,255,0.04)",
            border: liveOnly
              ? "1px solid rgba(45,212,191,0.4)"
              : "1px solid rgba(255,255,255,0.07)",
            color: liveOnly ? "#2dd4bf" : "#64748b",
          }}
          data-testid="filter-liveOnly"
        >
          <Activity className="h-3.5 w-3.5 shrink-0" />
          {liveOnly ? "Только онлайн" : "Все игры"}
        </button>
      </div>

      {categories.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-2 font-mono">
            Категория
          </div>
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => onCategoryChange("")}
              className="text-left text-xs px-2 py-1 rounded transition-colors"
              style={{
                background: !category ? "rgba(14,165,233,0.12)" : "transparent",
                color: !category ? "#38bdf8" : "#64748b",
              }}
            >
              Все категории
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => onCategoryChange(cat === category ? "" : cat)}
                className="text-left text-xs px-2 py-1 rounded transition-colors truncate"
                style={{
                  background: category === cat ? "rgba(14,165,233,0.12)" : "transparent",
                  color: category === cat ? "#38bdf8" : "#64748b",
                }}
                data-testid={`filter-category-${cat}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-2 font-mono">
          Возможности
        </div>
        <div className="flex flex-col gap-1">
          {GAMES_BOOL_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => onToggleBool(f.key)}
              className="text-left text-xs px-2 py-1 rounded transition-colors flex items-center gap-1.5"
              style={{
                background: boolFilters[f.key]
                  ? "rgba(14,165,233,0.12)"
                  : "transparent",
                color: boolFilters[f.key] ? "#38bdf8" : "#64748b",
              }}
              data-testid={`filter-${f.key}`}
            >
              <span
                className="w-3 h-3 rounded border flex items-center justify-center flex-shrink-0"
                style={{
                  borderColor: boolFilters[f.key]
                    ? "#0ea5e9"
                    : "rgba(255,255,255,0.12)",
                  background: boolFilters[f.key] ? "#0ea5e9" : "transparent",
                }}
              >
                {boolFilters[f.key] && (
                  <span className="w-1.5 h-1.5 rounded-sm bg-white" />
                )}
              </span>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {allGenres.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-2 font-mono">
            Жанры
          </div>
          <div className="flex flex-col gap-1">
            {allGenres.map((genre) => (
              <button
                key={genre}
                type="button"
                onClick={() => onToggleGenre(genre)}
                className="text-left text-xs px-2 py-1 rounded transition-colors flex items-center gap-1.5"
                style={{
                  background: selectedGenres.includes(genre)
                    ? "rgba(14,165,233,0.12)"
                    : "transparent",
                  color: selectedGenres.includes(genre) ? "#38bdf8" : "#64748b",
                }}
                data-testid={`filter-genre-${genre}`}
              >
                <span
                  className="w-3 h-3 rounded border flex items-center justify-center flex-shrink-0"
                  style={{
                    borderColor: selectedGenres.includes(genre)
                      ? "#0ea5e9"
                      : "rgba(255,255,255,0.12)",
                    background: selectedGenres.includes(genre)
                      ? "#0ea5e9"
                      : "transparent",
                  }}
                >
                  {selectedGenres.includes(genre) && (
                    <span className="w-1.5 h-1.5 rounded-sm bg-white" />
                  )}
                </span>
                {formatGenreLabel(genre)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-2 font-mono">
          Соединение
        </div>
        <p className="text-[11px] text-slate-600 leading-relaxed">
          Пинг до хоста смотри на странице «Хосты» — там живые карточки с задержкой.
        </p>
      </div>

      {globalMaxLzt > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-2 font-mono">
            Макс. цена: {maxLzt} LZT/мин
          </div>
          <input
            type="range"
            min={0}
            max={globalMaxLzt}
            value={maxLzt}
            onChange={(e) => onMaxLztChange(Number(e.target.value))}
            className="w-full accent-sky-400"
            style={{ accentColor: "#0ea5e9" }}
            data-testid="slider-max-price"
          />
          <div className="flex justify-between text-[10px] text-slate-600 font-mono mt-0.5">
            <span>0</span>
            <span>{globalMaxLzt}</span>
          </div>
        </div>
      )}
    </div>
  );
}
