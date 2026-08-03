/** Lowercase exe names treated as browser processes for browser-game guard. */
export const BROWSER_EXE_NAMES = new Set([
  "chrome.exe",
  "chromium.exe",
  "msedge.exe",
  "firefox.exe",
  "opera.exe",
  "brave.exe",
  "vivaldi.exe",
  "yandex.exe",
  "iexplore.exe",
]);

export function isBrowserExeName(exeName: string): boolean {
  return BROWSER_EXE_NAMES.has(exeName.trim().toLowerCase());
}
