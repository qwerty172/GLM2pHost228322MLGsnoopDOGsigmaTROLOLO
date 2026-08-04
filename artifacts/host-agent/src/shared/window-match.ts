/**
 * Window capture matching — title heuristics + optional HWND/PID after spawn (H-08).
 *
 * Uses desktopCapturer source `name` (window title as shown in Alt+Tab).
 * Title-only heuristics are the default (HOSTING H-01). After native spawn,
 * HWND match via launched PID is tried first (HOSTING H-08).
 */

export const BROWSER_TITLE_HINTS = [
  "chrome",
  "chromium",
  "msedge",
  "edge",
  "firefox",
  "opera",
  "brave",
  "yandex",
  "google chrome",
  "microsoft edge",
];

export type CaptureSource = { id: string; name: string };

export function exeBasename(path: string | undefined | null): string | undefined {
  return path
    ?.split(/[\\/]/)
    .pop()
    ?.replace(/\.exe$/i, "")
    .toLowerCase();
}

export type LibraryAppPath = { gameId: string; appPath?: string | null };

/** Native capture target: library entry for currentGameId, else cfg.appPath basename. */
export function resolveTargetExeName(
  currentGameId: string | null,
  libraryEntries: LibraryAppPath[],
  appPath: string | undefined | null,
): string | undefined {
  if (currentGameId) {
    const entry = libraryEntries.find((e) => e.gameId === currentGameId);
    const name = exeBasename(entry?.appPath);
    if (name) return name;
  }
  return exeBasename(appPath);
}

export function hostFromBoundUrl(boundUrl: string): string {
  try {
    return new URL(boundUrl).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function looksLikeBrowserWindow(title: string): boolean {
  const n = title.toLowerCase();
  return BROWSER_TITLE_HINTS.some((h) => n.includes(h));
}

/** Non-screen capture sources (window titles from desktopCapturer). */
export function windowSources(sources: CaptureSource[]): CaptureSource[] {
  return sources.filter((s) => !s.id.startsWith("screen:"));
}

export function findBrowserCaptureSource(
  sources: CaptureSource[],
  boundUrl: string,
): CaptureSource | undefined {
  const host = hostFromBoundUrl(boundUrl);
  const windows = windowSources(sources);
  if (host) {
    const byHost = windows.find((s) => {
      const n = s.name.toLowerCase();
      return n.includes(host) && looksLikeBrowserWindow(s.name);
    });
    if (byHost) return byHost;
    const anyWithHost = windows.find((s) => s.name.toLowerCase().includes(host));
    if (anyWithHost) return anyWithHost;
  }
  return windows.find((s) => looksLikeBrowserWindow(s.name));
}

export function findNativeCaptureSource(
  sources: CaptureSource[],
  exeName: string,
): CaptureSource | undefined {
  const target = exeName.trim().toLowerCase();
  if (!target) return undefined;
  return windowSources(sources).find((s) => s.name.toLowerCase().includes(target));
}

/** Parse HWND from Electron desktopCapturer id (`window:<hwnd>:0`). */
export function hwndFromCaptureSourceId(sourceId: string): number | null {
  if (!sourceId.startsWith("window:")) return null;
  const hwnd = Number.parseInt(sourceId.split(":")[1] ?? "", 10);
  return Number.isFinite(hwnd) && hwnd > 0 ? hwnd : null;
}

/**
 * Match capture source by HWND list from spawned game process (HOSTING H-08).
 * Prefers earlier HWNDs (caller should put foreground window first).
 */
export function findCaptureSourceByHwnds(
  sources: CaptureSource[],
  hwnds: number[],
): CaptureSource | undefined {
  if (hwnds.length === 0) return undefined;
  const byHwnd = new Map<number, CaptureSource>();
  for (const source of windowSources(sources)) {
    const hwnd = hwndFromCaptureSourceId(source.id);
    if (hwnd !== null) byHwnd.set(hwnd, source);
  }
  for (const hwnd of hwnds) {
    const match = byHwnd.get(hwnd);
    if (match) return match;
  }
  return undefined;
}

/** Match configured captureSourceName against enumerated titles (exact, then case-insensitive). */
export function findCaptureSourceByTitle(
  sources: CaptureSource[],
  title: string,
): CaptureSource | undefined {
  const trimmed = title.trim();
  if (!trimmed) return undefined;
  const exact = sources.find((s) => s.name === trimmed);
  if (exact) return exact;
  const lower = trimmed.toLowerCase();
  return sources.find((s) => s.name.toLowerCase() === lower);
}

/**
 * Browser session liveness — any browser window counts as alive (HOSTING H-02).
 * hostHint is kept for API compat; liveness does not require hostname in title.
 */
export function browserWindowStillOpen(sources: CaptureSource[], _hostHint: string): boolean {
  return windowSources(sources).some((s) => looksLikeBrowserWindow(s.name));
}
