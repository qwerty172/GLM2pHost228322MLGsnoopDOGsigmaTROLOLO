// HTTP client helpers for host-agent → platform API communication.
// Runs in the Electron main process (Node.js) so we use Node's built-in
// fetch (available since Electron 22 / Node 18).

import type { LibraryEntry, ScheduleSlot } from "../shared/messages";
import { getAgentVersion } from "./agent-version";
import { log } from "./logger";
import { isAgentVersionSupported } from "./agent-version-policy";

function base(apiBaseUrl: string): string {
  return apiBaseUrl.replace(/\/$/, "");
}

// Fetch this host's current schedule config from the server (source of
// truth — the web dashboard writes it there directly). Returns null on
// network/auth errors so callers can skip and retry on the next cycle.
export async function fetchHostSchedule(
  hostToken: string,
  apiBaseUrl: string,
): Promise<{ scheduleMode: string; scheduleJson: ScheduleSlot[] } | null> {
  try {
    const url = `${base(apiBaseUrl)}/api/hosts/${encodeURIComponent(hostToken)}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      log("warn", `fetchHostSchedule HTTP ${resp.status}`);
      return null;
    }
    const data = (await resp.json()) as {
      scheduleMode: string;
      scheduleJson: ScheduleSlot[];
    };
    return { scheduleMode: data.scheduleMode, scheduleJson: data.scheduleJson ?? [] };
  } catch (err) {
    log("warn", `fetchHostSchedule error: ${String(err)}`);
    return null;
  }
}

// Fetch the full game library for this host token.
// Returns null on network / auth errors (caller should log and skip validation).
export async function fetchLibrary(
  hostToken: string,
  apiBaseUrl: string,
): Promise<LibraryEntry[] | null> {
  try {
    const url = `${base(apiBaseUrl)}/api/hosts/${encodeURIComponent(hostToken)}/library`;
    const resp = await fetch(url, {
      headers: { "content-type": "application/json" },
    });
    if (!resp.ok) {
      log("warn", `fetchLibrary HTTP ${resp.status}`);
      return null;
    }
    const data = (await resp.json()) as LibraryEntry[];
    return data;
  } catch (err) {
    log("warn", `fetchLibrary error: ${String(err)}`);
    return null;
  }
}

// Send a heartbeat to keep lastSeenAt fresh. Measures RTT to the server via
// the lightweight /api/public/ping probe, then reports it as `pingMs` in the
// heartbeat body so the catalog can sort hosts by latency.
// Fire-and-forget — caller should call this on an interval and ignore failures.
export async function sendHeartbeat(
  hostToken: string,
  apiBaseUrl: string,
): Promise<void> {
  try {
    // Measure RTT with a lightweight probe first, then report in heartbeat.
    const probeUrl = `${base(apiBaseUrl)}/api/public/ping`;
    const t0 = Date.now();
    await fetch(probeUrl);
    const pingMs = Date.now() - t0;

    const url = `${base(apiBaseUrl)}/api/hosts/heartbeat`;
    await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-host-token": hostToken,
      },
      body: JSON.stringify({ hostToken, pingMs, agentVersion: getAgentVersion() }),
    });
  } catch {
    // Intentionally silent — network blips should not log noise.
  }
}

// Report local availability of a single library entry to the server.
// Called after we check whether the .exe file exists on disk.
export async function patchLocalAvailability(
  hostToken: string,
  apiBaseUrl: string,
  gameId: string,
  localAvailable: boolean,
  lastError?: string,
): Promise<void> {
  try {
    const url = `${base(apiBaseUrl)}/api/hosts/${encodeURIComponent(hostToken)}/library/${encodeURIComponent(gameId)}`;
    await fetch(url, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        localAvailable,
        lastError: lastError ?? "",
      }),
    });
  } catch (err) {
    log("warn", `patchLocalAvailability error: ${String(err)}`);
  }
}

export type AgentRequirements = {
  minSupportedAgentVersion: string;
};

/** Fetch platform minimum agent version (U-17). */
export async function fetchAgentRequirements(
  apiBaseUrl: string,
): Promise<AgentRequirements | null> {
  try {
    const url = `${base(apiBaseUrl)}/api/public/agent-requirements`;
    const resp = await fetch(url);
    if (!resp.ok) {
      log("warn", `fetchAgentRequirements HTTP ${resp.status}`);
      return null;
    }
    const data = (await resp.json()) as AgentRequirements;
    if (!data.minSupportedAgentVersion) return null;
    return data;
  } catch (err) {
    log("warn", `fetchAgentRequirements error: ${String(err)}`);
    return null;
  }
}

/**
 * Logs a Russian warning when the running build is below the platform minimum (U-17).
 * Returns false when streaming should be blocked client-side.
 */
export function warnIfAgentVersionUnsupported(
  currentVersion: string,
  minSupportedVersion: string,
): boolean {
  if (isAgentVersionSupported(currentVersion, minSupportedVersion)) {
    return true;
  }
  log(
    "warn",
    `Версия агента ${currentVersion} устарела — нужна ${minSupportedVersion} или новее. ` +
      "Скачай обновление с дашборда («Обновить агент») до запуска стрима.",
  );
  return false;
}

export type SaveUrlResult = {
  ok: boolean;
  status?: number;
  downloadURL?: string;
  uploadURL?: string;
  objectPath?: string;
  error?: string;
};

export async function requestSaveDownloadUrl(
  hostToken: string,
  apiBaseUrl: string,
  sessionId: string,
): Promise<SaveUrlResult> {
  try {
    const url =
      `${base(apiBaseUrl)}/api/saves/download-url?sessionId=${encodeURIComponent(sessionId)}`;
    const resp = await fetch(url, {
      headers: { "x-host-token": hostToken },
    });
    if (resp.status === 404) {
      return { ok: false, status: 404 };
    }
    if (resp.status === 503) {
      return { ok: false, status: 503, error: "storage_unavailable" };
    }
    if (!resp.ok) {
      return { ok: false, status: resp.status, error: `HTTP ${resp.status}` };
    }
    const data = (await resp.json()) as { downloadURL?: string; objectPath?: string };
    if (!data.downloadURL) {
      return { ok: false, error: "missing_download_url" };
    }
    return {
      ok: true,
      downloadURL: data.downloadURL,
      objectPath: data.objectPath,
    };
  } catch (err) {
    log("warn", `requestSaveDownloadUrl error: ${String(err)}`);
    return { ok: false, error: String(err) };
  }
}

export async function requestSaveUploadUrl(
  hostToken: string,
  apiBaseUrl: string,
  sessionId: string,
  sizeBytes: number,
): Promise<SaveUrlResult> {
  try {
    const url = `${base(apiBaseUrl)}/api/saves/upload-url`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-host-token": hostToken,
      },
      body: JSON.stringify({ sessionId, sizeBytes }),
    });
    if (resp.status === 503) {
      return { ok: false, status: 503, error: "storage_unavailable" };
    }
    if (!resp.ok) {
      return { ok: false, status: resp.status, error: `HTTP ${resp.status}` };
    }
    const data = (await resp.json()) as { uploadURL?: string; objectPath?: string };
    if (!data.uploadURL) {
      return { ok: false, error: "missing_upload_url" };
    }
    return {
      ok: true,
      uploadURL: data.uploadURL,
      objectPath: data.objectPath,
    };
  } catch (err) {
    log("warn", `requestSaveUploadUrl error: ${String(err)}`);
    return { ok: false, error: String(err) };
  }
}

export async function confirmSaveUpload(
  hostToken: string,
  apiBaseUrl: string,
  sessionId: string,
  contentHash: string,
  sizeBytes: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const url = `${base(apiBaseUrl)}/api/saves/confirm`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-host-token": hostToken,
      },
      body: JSON.stringify({ sessionId, contentHash, sizeBytes }),
    });
    if (!resp.ok) {
      return { ok: false, error: `HTTP ${resp.status}` };
    }
    return { ok: true };
  } catch (err) {
    log("warn", `confirmSaveUpload error: ${String(err)}`);
    return { ok: false, error: String(err) };
  }
}
