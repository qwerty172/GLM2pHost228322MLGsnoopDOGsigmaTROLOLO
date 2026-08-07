import { downloadHostAgentZip } from "@workspace/api-client-react";

export const HEARTBEAT_FRESH_MS = 45_000;

export const HOST_TOKEN_STORAGE_PREFIX = "streamline.browserHostToken:";
export const BROWSER_HOST_URL_STORAGE_PREFIX = "streamline.browserHostUrl:";
export const HOST_AGENT_DOWNLOADED_STORAGE_KEY = "streamline.hostAgentDownloaded";
export const HOST_AGENT_INSTALL_METHOD_STORAGE_KEY = "streamline.hostAgentInstallMethod";
export const HOST_GO_ONLINE_ACK_STORAGE_KEY = "streamline.hostGoOnlineAck";

/** How the host installed the agent — drives bind-step visibility (U-35). */
export type HostAgentInstallMethod = "zip" | "exe";

/** Short label on the ZIP download button (U-35). */
export const HOST_AGENT_ZIP_DOWNLOAD_LABEL = "Токен уже внутри";
/** Short label on the .exe download button (U-35). */
export const HOST_AGENT_EXE_DOWNLOAD_LABEL = "Понадобится код привязки";

/**
 * Installer download (U-31): no Node.js/npm install required, unlike the ZIP.
 * Resolves server-side to the latest GitHub Release asset (or falls back to
 * a clear 503 if none has been published yet) — see routes/downloads.ts.
 * Needs no Authorization header: the installer itself carries no per-host
 * config, so a plain navigation/new-tab link is enough.
 */
export const HOST_AGENT_EXE_DOWNLOAD_URL = "/api/downloads/host-agent.exe";

/** Title when the Windows installer has not been published yet (U-36). */
export const HOST_AGENT_EXE_UNAVAILABLE_TITLE = "Установщик .exe пока недоступен";

/** Default hint when probe fails or API returns no message (U-36). */
export const HOST_AGENT_EXE_UNAVAILABLE_HINT =
  "Готовый установщик ещё не опубликован (нет тега host-agent-v*). Скачайте ZIP-архив — токен уже внутри.";

/** Title for Windows SmartScreen notice before .exe download (U-37). */
export const HOST_AGENT_EXE_WINDOWS_WARNING_TITLE =
  "Windows может запросить подтверждение";

/** Body — SmartScreen/Defender prompt is expected, not an agent failure (U-37). */
export const HOST_AGENT_EXE_WINDOWS_WARNING_BODY =
  "При скачивании или первом запуске установщика Windows может показать «Защитник» или «Подтверждение». Нажмите «Подробнее» → «Выполнить в любом случае» — это ожидаемо и не означает поломку агента.";

/** Hint while waiting for agent after .exe install — avoids dead-end panic (U-37). */
export const HOST_AGENT_EXE_WAIT_SMARTSCREEN_HINT =
  "Если Windows только что спрашивала разрешение — агент мог ещё не запуститься. Открой DecentralHub из меню «Пуск» или с рабочего стола; пока нет связи — это нормально, не ошибка.";

export type HostAgentExeAvailability =
  | { status: "checking" }
  | { status: "available" }
  | { status: "unavailable"; message: string };

/**
 * Checks whether `/downloads/host-agent.exe` would redirect to a real installer (U-36).
 * Uses `redirect: manual` so the browser does not follow GitHub URLs.
 */
export async function probeHostAgentExeAvailability(
  fetchImpl: typeof fetch = fetch,
): Promise<Exclude<HostAgentExeAvailability, { status: "checking" }>> {
  try {
    const res = await fetchImpl(HOST_AGENT_EXE_DOWNLOAD_URL, {
      method: "GET",
      redirect: "manual",
      credentials: "same-origin",
    });
    if (res.status === 302 || res.type === "opaqueredirect") {
      return { status: "available" };
    }
    if (res.status === 503) {
      let message = HOST_AGENT_EXE_UNAVAILABLE_HINT;
      try {
        const json = (await res.json()) as { error?: string };
        if (json.error?.trim()) message = json.error.trim();
      } catch {
        // keep default hint
      }
      return { status: "unavailable", message };
    }
    return { status: "unavailable", message: HOST_AGENT_EXE_UNAVAILABLE_HINT };
  } catch {
    return { status: "unavailable", message: HOST_AGENT_EXE_UNAVAILABLE_HINT };
  }
}

/** Custom URL scheme handled by the Windows host agent (U-34). */
export const DECENTHUB_PROTOCOL_SCHEME = "decenthub";

export type AgentDeepLinkParams = {
  apiBaseUrl: string;
  bindCode?: string | null;
  pairCode?: string | null;
};

/** Launch a custom-scheme deep link without navigating the dashboard SPA away (U-34). */
export function openDecenthubDeepLink(deepLink: string, doc: Document = document): void {
  const trimmed = deepLink.trim();
  if (!trimmed) return;
  const a = doc.createElement("a");
  a.href = trimmed;
  a.rel = "noopener noreferrer";
  a.style.display = "none";
  doc.body.appendChild(a);
  a.click();
  a.remove();
}

/** Build `decenthub://bind?...` for one-click .exe pairing from the dashboard (U-34). */
export function buildAgentDeepLink(params: AgentDeepLinkParams): string {
  const api = params.apiBaseUrl.trim();
  if (!api) {
    throw new Error("apiBaseUrl required");
  }
  const search = new URLSearchParams();
  search.set("api", api);
  const bind = params.bindCode?.trim();
  const pair = params.pairCode?.trim();
  if (bind) search.set("bind", bind);
  if (pair) search.set("pair", pair);
  if (!bind && !pair) {
    return `${DECENTHUB_PROTOCOL_SCHEME}://open`;
  }
  return `${DECENTHUB_PROTOCOL_SCHEME}://bind?${search.toString()}`;
}

/** Parse deep links emitted by the dashboard — shared with host-agent tests (U-34). */
export function parseAgentDeepLink(
  raw: string,
): { action: "open" | "bind"; apiBaseUrl: string | null; bindCode: string | null; pairCode: string | null } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== `${DECENTHUB_PROTOCOL_SCHEME}:`) return null;
  const action = url.hostname === "bind" ? "bind" : url.hostname === "open" ? "open" : null;
  if (!action) return null;
  const apiBaseUrl = url.searchParams.get("api")?.trim() || null;
  const bindCode = url.searchParams.get("bind")?.trim() || null;
  const pairCode = url.searchParams.get("pair")?.trim() || null;
  return { action, apiBaseUrl, bindCode, pairCode };
}

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

export function readHostAgentInstallMethod(
  storage: Pick<Storage, "getItem"> = localStorage,
): HostAgentInstallMethod | null {
  const v = storage.getItem(HOST_AGENT_INSTALL_METHOD_STORAGE_KEY);
  return v === "zip" || v === "exe" ? v : null;
}

export function markHostAgentInstallMethod(
  method: HostAgentInstallMethod,
  storage: Pick<Storage, "setItem"> = localStorage,
): void {
  try {
    storage.setItem(HOST_AGENT_INSTALL_METHOD_STORAGE_KEY, method);
  } catch {
    // ignore quota / private mode
  }
}

export function readHostGoOnlineAck(
  storage: Pick<Storage, "getItem"> = localStorage,
): boolean {
  return storage.getItem(HOST_GO_ONLINE_ACK_STORAGE_KEY) === "1";
}

export function markHostGoOnlineAck(
  storage: Pick<Storage, "setItem"> = localStorage,
): void {
  try {
    storage.setItem(HOST_GO_ONLINE_ACK_STORAGE_KEY, "1");
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

export type OnboardingPhase =
  | "download"
  | "wait-agent"
  | "bind-agent"
  | "add-game"
  | "go-online"
  | "update-agent"
  | "test-stream"
  | "complete";

export type GuidedNextAction = {
  phase: OnboardingPhase;
  stepNumber: number;
  totalSteps: number;
  title: string;
  hint: string;
  /** Which primary control to render — at most one per screen (U-13). */
  cta:
    | "download"
    | "wait"
    | "bind-agent"
    | "add-game"
    | "open-agent"
    | "update-agent"
    | "test-stream"
    | "none";
};

/** ZIP path: 5 steps. EXE path adds bind-agent (U-35). */
export const ONBOARDING_TOTAL_STEPS = 5;

export function onboardingTotalSteps(
  installMethod: HostAgentInstallMethod | null | undefined,
): number {
  return installMethod === "exe" ? 6 : ONBOARDING_TOTAL_STEPS;
}

export function hasCompletedFirstStream(
  sessions: Array<{ status: string }> | null | undefined,
): boolean {
  return (sessions?.length ?? 0) > 0;
}

/** Compare semver-like strings: -1 if a<b, 0 if equal, 1 if a>b (U-17). */
export function compareAgentVersions(a: string, b: string): number {
  const parse = (v: string) =>
    v
      .replace(/^v/i, "")
      .split(/[.+_-]/)
      .map((part) => {
        const n = parseInt(part, 10);
        return Number.isFinite(n) ? n : 0;
      });
  const av = parse(a);
  const bv = parse(b);
  const len = Math.max(av.length, bv.length, 3);
  for (let i = 0; i < len; i++) {
    const diff = (av[i] ?? 0) - (bv[i] ?? 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}

export type AgentVersionCheck = {
  compatible: boolean;
  currentVersion: string | null;
  minSupportedVersion: string;
  /** Russian explanation when incompatible. */
  message: string | null;
};

/** Returns compatible=true when version unknown or meets minimum (U-17). */
export function evaluateAgentVersionCompatibility(
  agentVersion: string | null | undefined,
  minSupportedVersion: string,
): AgentVersionCheck {
  const min = minSupportedVersion.trim();
  if (!min) {
    return {
      compatible: true,
      currentVersion: agentVersion ?? null,
      minSupportedVersion: min,
      message: null,
    };
  }
  const current = agentVersion?.trim();
  if (!current || current === "?") {
    return {
      compatible: true,
      currentVersion: current ?? null,
      minSupportedVersion: min,
      message: null,
    };
  }
  const compatible = compareAgentVersions(current, min) >= 0;
  return {
    compatible,
    currentVersion: current,
    minSupportedVersion: min,
    message: compatible
      ? null
      : `Версия агента ${current} устарела — нужна ${min} или новее. Обнови сборку до запуска стрима.`,
  };
}

export function isAgentVersionBlockingStream(
  agent: AgentState,
  minSupportedVersion: string | undefined,
): boolean {
  if (agent.status !== "online" || !minSupportedVersion) return false;
  return !evaluateAgentVersionCompatibility(agent.version, minSupportedVersion).compatible;
}

export function resolveGuidedNextAction(opts: {
  agent: AgentState;
  heartbeat: HeartbeatState;
  agentKeyBound: boolean;
  libraryCount: number;
  hasActiveSession: boolean;
  agentDownloaded?: boolean;
  installMethod?: HostAgentInstallMethod | null;
  goOnlineAck?: boolean;
  hasFirstStream?: boolean;
  minSupportedAgentVersion?: string;
}): GuidedNextAction {
  const totalSteps = onboardingTotalSteps(opts.installMethod);
  const exePath = opts.installMethod === "exe";

  if (opts.hasFirstStream) {
    return {
      phase: "complete",
      stepNumber: totalSteps,
      totalSteps,
      title: "Первый стрим готов",
      hint: "Можно принимать игроков и пользоваться полным дашбордом",
      cta: "none",
    };
  }

  const agentOnline = isAgentOnline(opts.agent, opts.heartbeat);
  const downloadDone =
    Boolean(opts.agentDownloaded) || isAgentOnceSeen(opts.agent, opts.heartbeat);

  if (!downloadDone) {
    return {
      phase: "download",
      stepNumber: 1,
      totalSteps,
      title: "Скачай агент",
      hint: exePath
        ? "Выбери ZIP (токен уже внутри) или установщик .exe (понадобится код привязки)"
        : "ZIP — токен уже внутри. Установщик .exe — без Node.js, но понадобится код привязки",
      cta: "download",
    };
  }

  if (!agentOnline) {
    return {
      phase: "wait-agent",
      stepNumber: 2,
      totalSteps,
      title: "Дождись связи с агентом",
      hint: exePath
        ? `Установи и запусти агент — здесь появится «Агент онлайн», затем привяжем ключ. ${HOST_AGENT_EXE_WAIT_SMARTSCREEN_HINT}`
        : "Запусти start.bat — здесь появится «Агент онлайн». Токен и привязка ключа из ZIP выполняются сами",
      cta: "wait",
    };
  }

  if (exePath && !opts.agentKeyBound) {
    return {
      phase: "bind-agent",
      stepNumber: 3,
      totalSteps,
      title: "Привяжи ключ агента",
      hint: "После .exe нужен код привязки — нажми «Открыть в агенте», цифры подставятся сами",
      cta: "bind-agent",
    };
  }

  const addGameStep = exePath ? 4 : 3;
  if (opts.libraryCount === 0) {
    return {
      phase: "add-game",
      stepNumber: addGameStep,
      totalSteps,
      title: "Добавь первую игру",
      hint: "Укажи путь к .exe и выбери игру из каталога",
      cta: "add-game",
    };
  }

  const goOnlineAck = Boolean(opts.goOnlineAck) || opts.hasActiveSession;
  const goOnlineStep = exePath ? 5 : 4;

  if (!goOnlineAck) {
    return {
      phase: "go-online",
      stepNumber: goOnlineStep,
      totalSteps,
      title: "Выйди в онлайн",
      hint: "В агенте нажми «Выйти в онлайн» — игроки увидят тебя в каталоге",
      cta: "open-agent",
    };
  }

  if (
    opts.agent.status === "online" &&
    opts.minSupportedAgentVersion &&
    isAgentVersionBlockingStream(opts.agent, opts.minSupportedAgentVersion)
  ) {
    const versionCheck = evaluateAgentVersionCompatibility(
      opts.agent.version,
      opts.minSupportedAgentVersion,
    );
    return {
      phase: "update-agent",
      stepNumber: totalSteps,
      totalSteps,
      title: "Обнови агент",
      hint:
        versionCheck.message ??
        "Текущая версия агента не поддерживается — скачай новую сборку",
      cta: "update-agent",
    };
  }

  const testStreamStep = exePath ? 6 : 5;
  return {
    phase: "test-stream",
    stepNumber: testStreamStep,
    totalSteps,
    title: "Проверь стрим",
    hint: "Создай тест-сессию и убедись, что картинка и управление работают",
    cta: "test-stream",
  };
}

export function computeQuickStartSteps(opts: {
  agent: AgentState;
  heartbeat: HeartbeatState;
  agentKeyBound: boolean;
  libraryCount: number;
  hasActiveSession: boolean;
  agentDownloaded?: boolean;
  goOnlineAck?: boolean;
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
      done: opts.libraryCount > 0,
      title: "Добавь игру",
      hint: opts.libraryCount > 0 ? `${opts.libraryCount} в библиотеке` : "Одна игра — и можно стримить",
    },
    {
      done:
        opts.hasActiveSession ||
        Boolean(opts.goOnlineAck),
      title: "В онлайн",
      hint: opts.hasActiveSession
        ? "Принимаешь игроков"
        : "В агенте нажми «Выйти в онлайн»",
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  return { steps, doneCount, allDone: doneCount === steps.length };
}

export type HostReadinessCheck = {
  id: string;
  ok: boolean;
  label: string;
};

export type HostReadinessResult = {
  ready: boolean;
  headline: string;
  /** One concrete next fix in Russian when not ready (U-14). */
  nextFix: string | null;
  checks: HostReadinessCheck[];
};

const HOST_READINESS_READY_HEADLINE = "Можно тестировать";
const HOST_READINESS_NOT_READY_HEADLINE = "Не готово";

/**
 * Evaluates the full host path from aggregated server + local probe data.
 * Returns exactly one next fix when not ready (U-14).
 */
export function evaluateHostReadiness(opts: {
  apiOk: boolean;
  agentKeyBound: boolean;
  heartbeat: HeartbeatState;
  agent: AgentState;
  enabledGamesCount: number;
  hasActiveSession: boolean;
  goOnlineAck?: boolean;
  localAgentReachable: boolean;
  localInputOk: boolean;
  minSupportedAgentVersion?: string;
}): HostReadinessResult {
  const checks: HostReadinessCheck[] = [
    { id: "api", ok: opts.apiOk, label: "Связь с API" },
    {
      id: "heartbeat",
      ok: opts.heartbeat.status === "fresh",
      label: "Heartbeat агента на сервере",
    },
    {
      id: "local-agent",
      ok: opts.localAgentReachable,
      label: "Локальный агент на этом ПК",
    },
    { id: "bind", ok: opts.agentKeyBound, label: "Привязка ключа агента" },
    {
      id: "games",
      ok: opts.enabledGamesCount > 0,
      label: "Доступная игра в библиотеке",
    },
    {
      id: "session",
      ok: opts.hasActiveSession || Boolean(opts.goOnlineAck),
      label: "Готовность к сессии",
    },
    { id: "input", ok: opts.localInputOk, label: "Локальный ввод" },
  ];

  if (opts.minSupportedAgentVersion && opts.agent.status === "online") {
    const versionOk = evaluateAgentVersionCompatibility(
      opts.agent.version,
      opts.minSupportedAgentVersion,
    ).compatible;
    checks.push({
      id: "agent-version",
      ok: versionOk,
      label: "Версия агента",
    });
  }

  const notReady = (
    nextFix: string,
  ): HostReadinessResult => ({
    ready: false,
    headline: HOST_READINESS_NOT_READY_HEADLINE,
    nextFix,
    checks,
  });

  if (!opts.apiOk) {
    return notReady(
      "Не удалось связаться с сервером — проверь интернет и обнови страницу",
    );
  }

  if (opts.heartbeat.status !== "fresh") {
    return notReady(
      "Запусти start.bat на Windows-ПК — агент не на связи с сервером",
    );
  }

  if (!opts.localAgentReachable) {
    return notReady(
      "Открой дашборд на том же ПК, где запущен агент, или установи агент здесь",
    );
  }

  if (
    opts.minSupportedAgentVersion &&
    opts.agent.status === "online" &&
    isAgentVersionBlockingStream(opts.agent, opts.minSupportedAgentVersion)
  ) {
    const versionCheck = evaluateAgentVersionCompatibility(
      opts.agent.version,
      opts.minSupportedAgentVersion,
    );
    return notReady(
      versionCheck.message ??
        "Версия агента устарела — нажми «Обновить агент» и установи новую сборку",
    );
  }

  if (!opts.agentKeyBound) {
    return notReady(
      "Привяжи ключ агента — перезапусти start.bat (ZIP с дашборда) или получи код в «Если не работает»",
    );
  }

  if (opts.enabledGamesCount === 0) {
    return notReady(
      "Добавь хотя бы одну включённую игру в библиотеку с путём к .exe",
    );
  }

  if (!opts.hasActiveSession && !opts.goOnlineAck) {
    return notReady(
      "В агенте нажми «Выйти в онлайн» — без этого игроки не увидят тебя",
    );
  }

  if (!opts.localInputOk) {
    return notReady(
      "Локальный ввод не отвечает — перезапусти агент от имени администратора",
    );
  }

  return {
    ready: true,
    headline: HOST_READINESS_READY_HEADLINE,
    nextFix: null,
    checks,
  };
}

export type HostDiagnosticActionKind =
  | "refresh-page"
  | "download-agent"
  | "update-agent"
  | "open-agent"
  | "scroll-bind"
  | "add-game"
  | "none";

export type HostDiagnosticAction = {
  checkId: string;
  actionLabel: string;
  kind: HostDiagnosticActionKind;
};

/** One concrete UI action per failed diagnostic check (U-18). */
export function resolveHostDiagnosticAction(checkId: string): HostDiagnosticAction {
  switch (checkId) {
    case "api":
      return { checkId, actionLabel: "Обновить страницу", kind: "refresh-page" };
    case "heartbeat":
      return { checkId, actionLabel: "Скачать агент", kind: "download-agent" };
    case "local-agent":
      return { checkId, actionLabel: "Скачать агент", kind: "download-agent" };
    case "agent-version":
      return { checkId, actionLabel: "Обновить агент", kind: "update-agent" };
    case "bind":
      return { checkId, actionLabel: "Получить код привязки", kind: "scroll-bind" };
    case "games":
      return { checkId, actionLabel: "Добавить игру", kind: "add-game" };
    case "session":
      return { checkId, actionLabel: "Открыть агент", kind: "open-agent" };
    case "input":
      return { checkId, actionLabel: "Перезапустить агент", kind: "none" };
    default:
      return { checkId, actionLabel: "Обновить проверку", kind: "none" };
  }
}

export function findFirstFailedDiagnosticAction(
  checks: HostReadinessCheck[],
): HostDiagnosticAction | null {
  const failed = checks.find((c) => !c.ok);
  return failed ? resolveHostDiagnosticAction(failed.id) : null;
}

/**
 * Live snapshot from dashboard props before async probe (U-18).
 * Input check is optimistic when local agent responds.
 */
export function buildLiveHostDiagnostics(opts: {
  apiOk: boolean;
  agentKeyBound: boolean;
  heartbeat: HeartbeatState;
  agent: AgentState;
  enabledGamesCount: number;
  hasActiveSession: boolean;
  goOnlineAck?: boolean;
  minSupportedAgentVersion?: string;
}): HostReadinessResult {
  const localAgentReachable = opts.agent.status === "online";
  const localInputOk = localAgentReachable;
  return evaluateHostReadiness({
    apiOk: opts.apiOk,
    agentKeyBound: opts.agentKeyBound,
    heartbeat: opts.heartbeat,
    agent: opts.agent,
    enabledGamesCount: opts.enabledGamesCount,
    hasActiveSession: opts.hasActiveSession,
    goOnlineAck: opts.goOnlineAck,
    localAgentReachable,
    localInputOk,
    minSupportedAgentVersion: opts.minSupportedAgentVersion,
  });
}

/** Placeholder for secrets stripped from diagnostic exports (U-19). */
export const DIAGNOSTIC_REDACTED = "[REDACTED]";

/**
 * Removes tokens, credentials and personal data from diagnostic text (U-19).
 * Safe to run on JSON.stringify output before clipboard copy.
 */
export function redactDiagnosticSecrets(text: string): string {
  let out = text;

  out = out.replace(/Bearer\s+[A-Za-z0-9._\-+/=]+/gi, `Bearer ${DIAGNOSTIC_REDACTED}`);

  out = out.replace(
    /"(hostToken|playerToken|password|bindCode|secret|authorization|apiKey|accessToken|refreshToken)"\s*:\s*"[^"]*"/gi,
    `"$1":"${DIAGNOSTIC_REDACTED}"`,
  );

  out = out.replace(
    /([?&](token|code|secret|password|invite|bind|key)=)[^&\s"']+/gi,
    `$1${DIAGNOSTIC_REDACTED}`,
  );

  out = out.replace(
    /\b(token|bindCode|password|secret|code)=([^\s"',}]+)/gi,
    `$1=${DIAGNOSTIC_REDACTED}`,
  );

  out = out.replace(/\/play\/(?:i\/)?[A-Za-z0-9_-]{6,}/g, `/play/${DIAGNOSTIC_REDACTED}`);

  out = out.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, DIAGNOSTIC_REDACTED);

  out = out.replace(
    /[A-Z]:(?:\\{1,2})Users(?:\\{1,2})[^"']+/gi,
    `C:\\\\Users\\\\${DIAGNOSTIC_REDACTED}`,
  );

  out = out.replace(/\b[A-Za-z0-9+/=_-]{40,}\b/g, DIAGNOSTIC_REDACTED);

  return out;
}

export type HostDiagnosticAgentEvent = {
  level: string;
  message: string;
  agentVersion?: string | null;
  createdAt: string;
};

export type HostDiagnosticReportInput = {
  generatedAt: string;
  readiness: HostReadinessResult;
  agent: AgentState;
  heartbeat: HeartbeatState;
  agentKeyBound: boolean;
  enabledGamesCount: number;
  hasActiveSession: boolean;
  minSupportedAgentVersion?: string;
  agentEvents?: HostDiagnosticAgentEvent[];
  localProbe?: {
    version?: string;
    audioMode?: string;
    inputOk?: boolean;
    port?: number;
  } | null;
};

/** Builds a clipboard-safe JSON diagnostic report (U-19). */
export function buildHostDiagnosticReport(opts: HostDiagnosticReportInput): string {
  const agentBlock =
    opts.agent.status === "online"
      ? {
          status: "online" as const,
          version: opts.agent.version,
          audioMode: opts.agent.audioMode,
          port: opts.agent.port,
        }
      : { status: opts.agent.status };

  const heartbeatBlock =
    opts.heartbeat.status === "fresh" || opts.heartbeat.status === "stale"
      ? { status: opts.heartbeat.status, lastSeenAt: opts.heartbeat.lastSeenAt }
      : { status: opts.heartbeat.status };

  const payload = {
    schema: "decentralhub-host-diagnostics/1",
    generatedAt: opts.generatedAt,
    summary: {
      ready: opts.readiness.ready,
      headline: opts.readiness.headline,
      nextFix: opts.readiness.nextFix,
    },
    versions: {
      agent: opts.agent.status === "online" ? opts.agent.version : null,
      minSupportedAgent: opts.minSupportedAgentVersion ?? null,
    },
    heartbeat: heartbeatBlock,
    agent: agentBlock,
    flags: {
      agentKeyBound: opts.agentKeyBound,
      enabledGamesCount: opts.enabledGamesCount,
      hasActiveSession: opts.hasActiveSession,
    },
    checks: opts.readiness.checks.map((c) => ({
      id: c.id,
      ok: c.ok,
      label: c.label,
    })),
    localProbe: opts.localProbe ?? null,
    recentAgentEvents: (opts.agentEvents ?? []).slice(0, 8).map((e) => ({
      level: e.level,
      message: e.message,
      at: e.createdAt,
      agentVersion: e.agentVersion ?? null,
    })),
  };

  return redactDiagnosticSecrets(JSON.stringify(payload, null, 2));
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
