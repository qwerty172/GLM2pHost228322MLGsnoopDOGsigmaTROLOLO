import { downloadHostAgentZip } from "@workspace/api-client-react";

export const HEARTBEAT_FRESH_MS = 45_000;

export const HOST_TOKEN_STORAGE_PREFIX = "streamline.browserHostToken:";
export const BROWSER_HOST_URL_STORAGE_PREFIX = "streamline.browserHostUrl:";
export const HOST_AGENT_DOWNLOADED_STORAGE_KEY = "streamline.hostAgentDownloaded";

/**
 * Installer download (U-31): no Node.js/npm install required, unlike the ZIP.
 * Resolves server-side to the latest GitHub Release asset (or falls back to
 * a clear 503 if none has been published yet) — see routes/downloads.ts.
 * Needs no Authorization header: the installer itself carries no per-host
 * config, so a plain navigation/new-tab link is enough.
 */
export const HOST_AGENT_EXE_DOWNLOAD_URL = "/api/downloads/host-agent.exe";

export type AudioMode = "off" | "voice" | "standard" | "quality";

export type AgentState =
  | { status: "checking" }
  | { status: "online"; version: string; audioMode: AudioMode; port: number }
  | { status: "offline" };

export type HeartbeatState =
  | { status: "unknown" }
  | { status: "fresh"; lastSeenAt: string }
  | { status: "stale"; lastSeenAt: string }
  | { status: "never" };

export type AgentDiagnosis = {
  symptom: string;
  likelyCause: string;
  action: string;
};

export const AUDIO_MODE_LABELS: Record<AudioMode, string> = {
  off: "Без звука",
  voice: "Голос ~12kbps",
  standard: "Стандарт ~32kbps",
  quality: "Качество ~64kbps",
};

export const EVENT_LEVEL_STYLES: Record<string, { badge: string; label: string }> = {
  fatal: { badge: "bg-red-500/15 text-red-300 border-red-500/30", label: "FATAL" },
  error: { badge: "bg-red-500/10 text-red-400 border-red-500/20", label: "ERROR" },
  warn: { badge: "bg-amber-500/10 text-amber-300 border-amber-500/20", label: "WARN" },
  info: { badge: "bg-slate-500/10 text-slate-400 border-slate-500/20", label: "INFO" },
};

export function getAgentDiagnosis(
  agent: AgentState,
  heartbeat: HeartbeatState,
): AgentDiagnosis[] {
  const rows: AgentDiagnosis[] = [];

  if (agent.status === "offline" && heartbeat.status === "fresh") {
    rows.push({
      symptom: "Браузер не видит агент на этом ПК",
      likelyCause: "Агент запущен на другом компьютере",
      action: "Открой дашборд на том же ПК, где работает start.bat, или установи агент здесь",
    });
  }

  if (heartbeat.status === "stale") {
    rows.push({
      symptom: "Агент перестал отвечать",
      likelyCause: "Процесс завершился или пропал интернет",
      action: "Перезапусти start.bat и проверь сеть на ПК с агентом",
    });
  }

  if (
    agent.status === "offline" &&
    (heartbeat.status === "never" || heartbeat.status === "unknown")
  ) {
    rows.push({
      symptom: "Агент ни разу не подключался",
      likelyCause: "start.bat не запускали или агент упал при старте",
      action: "Скачай ZIP, запусти start.bat от имени администратора",
    });
  }

  if (agent.status === "offline" && heartbeat.status !== "fresh") {
    rows.push({
      symptom: "Порт 18080 недоступен",
      likelyCause: "Файрвол блокирует или агент не слушает",
      action: "Разреши порты 18080–18083 в брандмауэре Windows",
    });
  }

  return rows;
}

export function resolveHeartbeatState(
  lastSeenAt: string | null | undefined,
  hostKnown: boolean,
  nowMs: number = Date.now(),
): HeartbeatState {
  if (!hostKnown) return { status: "unknown" };
  if (!lastSeenAt) return { status: "never" };
  if (nowMs - new Date(lastSeenAt).getTime() < HEARTBEAT_FRESH_MS) {
    return { status: "fresh", lastSeenAt };
  }
  return { status: "stale", lastSeenAt };
}

export function isAgentOnline(agent: AgentState, heartbeat: HeartbeatState): boolean {
  return agent.status === "online" || heartbeat.status === "fresh";
}

export function isAgentOnceSeen(agent: AgentState, heartbeat: HeartbeatState): boolean {
  return (
    agent.status === "online" ||
    heartbeat.status === "fresh" ||
    heartbeat.status === "stale"
  );
}

export function readHostAgentDownloaded(
  storage: Pick<Storage, "getItem"> = localStorage,
): boolean {
  return storage.getItem(HOST_AGENT_DOWNLOADED_STORAGE_KEY) === "1";
}

export function markHostAgentDownloaded(
  storage: Pick<Storage, "setItem"> = localStorage,
): void {
  try {
    storage.setItem(HOST_AGENT_DOWNLOADED_STORAGE_KEY, "1");
  } catch {
    // ignore quota / private mode
  }
}

export function agentNeedsAdvancedPanel(
  agent: AgentState,
  heartbeat: HeartbeatState,
): boolean {
  return (
    agent.status === "offline" ||
    heartbeat.status === "stale" ||
    heartbeat.status === "never"
  );
}

export function getAgentEventLevelStyle(level: string): { badge: string; label: string } {
  return EVENT_LEVEL_STYLES[level] ?? EVENT_LEVEL_STYLES.info;
}

export function buildPlayerPlayLink(opts: {
  origin: string;
  baseUrl: string;
  playerToken: string;
  inviteCode?: string | null;
}): string {
  const base = opts.baseUrl.replace(/\/$/, "");
  if (opts.inviteCode) {
    return `${opts.origin}${base}/play/i/${opts.inviteCode}`;
  }
  return `${opts.origin}${base}/play/${opts.playerToken}`;
}

export type TestSessionOpenTarget =
  | { kind: "host-play"; sessionId: string }
  | { kind: "player-play"; path: string };

export function resolveTestSessionOpenTarget(data: {
  session: { id: string; inviteCode?: string | null; playerToken: string };
  isExternalUrl?: boolean;
  hostBoundUrl?: string | null;
}): TestSessionOpenTarget {
  if (data.isExternalUrl && data.hostBoundUrl) {
    return { kind: "host-play", sessionId: data.session.id };
  }
  const playPath = data.session.inviteCode
    ? `play/i/${data.session.inviteCode}`
    : `play/${data.session.playerToken}`;
  return { kind: "player-play", path: playPath };
}

export function buildTestSessionFullUrl(
  origin: string,
  baseUrl: string,
  target: TestSessionOpenTarget,
): string {
  const base = baseUrl.replace(/\/$/, "");
  if (target.kind === "host-play") {
    return `${origin}${base}/host/play/${target.sessionId}`;
  }
  return `${origin}${base}/${target.path}`;
}

export function buildBrowserHostStorageKeys(sessionId: string): {
  hostTokenKey: string;
  browserHostUrlKey: string;
} {
  return {
    hostTokenKey: HOST_TOKEN_STORAGE_PREFIX + sessionId,
    browserHostUrlKey: BROWSER_HOST_URL_STORAGE_PREFIX + sessionId,
  };
}

export type QuickStartStep = { done: boolean; title: string; hint: string };

export function computeQuickStartSteps(opts: {
  agent: AgentState;
  heartbeat: HeartbeatState;
  agentKeyBound: boolean;
  libraryCount: number;
  hasActiveSession: boolean;
  agentDownloaded?: boolean;
}): { steps: QuickStartStep[]; doneCount: number; allDone: boolean } {
  const agentOnline = isAgentOnline(opts.agent, opts.heartbeat);
  const agentOnceSeen = isAgentOnceSeen(opts.agent, opts.heartbeat);
  const downloadDone = Boolean(opts.agentDownloaded) || agentOnceSeen;
  const steps: QuickStartStep[] = [
    {
      done: downloadDone,
      title: "Скачай агент",
      hint: downloadDone
        ? agentOnceSeen && !opts.agentDownloaded
          ? "Агент уже установлен на этом ПК"
          : "ZIP → start.bat на Windows-ПК"
        : "Нажми «Скачать агент» выше",
    },
    {
      done: agentOnline,
      title: "Агент онлайн",
      hint: agentOnline
        ? opts.agent.status === "online"
          ? `localhost:${opts.agent.port}`
          : "на связи через heartbeat"
        : "Запусти start.bat",
    },
    {
      done: opts.agentKeyBound,
      title: "Агент привязан",
      hint: "Код привязки ниже → вставь в агенте",
    },
    {
      done: opts.libraryCount > 0,
      title: "Добавь игру",
      hint: opts.libraryCount > 0 ? `${opts.libraryCount} в библиотеке` : "Одна игра — и можно стримить",
    },
    {
      done:
        opts.hasActiveSession ||
        (agentOnline && opts.libraryCount > 0 && opts.agentKeyBound),
      title: "В онлайн",
      hint: opts.hasActiveSession
        ? "Принимаешь игроков"
        : "В агенте нажми «Выйти в онлайн»",
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  return { steps, doneCount, allDone: doneCount === steps.length };
}

/** Download a personalized host-agent ZIP (Bearer token via customFetch). */
export async function downloadHostAgentBundle(): Promise<void> {
  const blob = await downloadHostAgentZip();
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = "cloud-gaming-host-agent.zip";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
