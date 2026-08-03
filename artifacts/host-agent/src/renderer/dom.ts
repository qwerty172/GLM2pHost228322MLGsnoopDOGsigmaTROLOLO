export const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
};

export const statusDot = document.querySelector<HTMLSpanElement>(".dot")!;
export const statusText = $("status-text") as HTMLSpanElement;
export const logEl = $("log") as HTMLPreElement;
export const form = $("settings-form") as HTMLFormElement;
export const connectBtn = $("connect") as HTMLButtonElement;
export const disconnectBtn = $("disconnect") as HTMLButtonElement;
export const shareCard = $("share-card") as HTMLElement;
export const playerLinkInput = $("player-link") as HTMLInputElement;
export const copyLinkBtn = $("copy-link") as HTMLButtonElement;
export const libraryCard = $("library-card") as HTMLElement;
export const libraryStatus = $("library-status") as HTMLParagraphElement;
export const libraryList = $("library-list") as HTMLUListElement;
export const refreshLibraryBtn = $("refresh-library") as HTMLButtonElement;
export const gamePickerCard = $("game-picker-card") as HTMLElement;
export const selectedGameSelect = $("selected-game-id") as HTMLSelectElement;
export const confirmGameBtn = $("confirm-game") as HTMLButtonElement;
export const cancelGamePickerBtn = $("cancel-game-picker") as HTMLButtonElement;
export const gamePickerHint = $("game-picker-hint") as HTMLParagraphElement;
export const gamePickerSteam = $("game-picker-steam") as HTMLDivElement;
export const gamePickerSteamTitle = $("game-picker-steam-title") as HTMLParagraphElement;
export const gamePickerSteamList = $("game-picker-steam-list") as HTMLUListElement;
export const previewIndicator = document.getElementById("preview-indicator") as HTMLSpanElement | null;
export const inputGuardBadge = document.getElementById("input-guard-badge") as HTMLSpanElement | null;
