// HTTP client helpers for host-agent → platform API communication.
// Runs in the Electron main process (Node.js) so we use Node's built-in
// fetch (available since Electron 22 / Node 18).

import type { LibraryEntry } from "../shared/messages";
import { log } from "./logger";

function base(apiBaseUrl: string): string {
  return apiBaseUrl.replace(/\/$/, "");
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

// Send a heartbeat to keep lastSeenAt fresh. Fire-and-forget — caller
// should call this on an interval and ignore failures.
export async function sendHeartbeat(
  hostToken: string,
  apiBaseUrl: string,
): Promise<void> {
  try {
    const url = `${base(apiBaseUrl)}/api/hosts/heartbeat`;
    await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-host-token": hostToken,
      },
      body: JSON.stringify({ hostToken }),
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
