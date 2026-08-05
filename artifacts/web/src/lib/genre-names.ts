/** Слаг/английское название жанра → русское отображение в UI игрока. */
const GENRE_NAMES_RU: Record<string, string> = {
  action: "Экшен",
  adventure: "Приключения",
  arcade: "Аркада",
  browser: "Браузерная",
  "browser roguelike": "Рогалик",
  casual: "Казуальная",
  fighting: "Файтинг",
  horror: "Хоррор",
  indie: "Инди",
  metroidvania: "Метроидвания",
  mmorpg: "MMORPG",
  multiplayer: "Мультиплеер",
  platformer: "Платформер",
  puzzle: "Головоломка",
  racing: "Гонки",
  rpg: "RPG",
  roguelike: "Рогалик",
  roguelite: "Рогалайт",
  shooter: "Шутер",
  simulation: "Симулятор",
  sports: "Спорт",
  strategy: "Стратегия",
  survival: "Выживание",
};

function capitalizeWords(s: string): string {
  return s
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Человекочитаемое название жанра для UI (русский словарь + fallback). */
export function formatGenreLabel(genre: string): string {
  const trimmed = genre.trim();
  if (!trimmed) return trimmed;
  const key = trimmed.toLowerCase();
  return GENRE_NAMES_RU[key] ?? capitalizeWords(trimmed);
}
