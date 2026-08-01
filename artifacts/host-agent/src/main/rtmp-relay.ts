// Optional RTMP restream sidecar via ffmpeg (Windows gdigrab → ingest URL).
// Started when the host goes online and stream relay is configured on the server.

import { spawn, type ChildProcess } from "node:child_process";
import { log } from "./logger";
import { buildGdigrabInput, buildRtmpUrl } from "./rtmp-relay-helpers";

export { buildGdigrabInput, buildRtmpUrl } from "./rtmp-relay-helpers";

let ffmpegProc: ChildProcess | null = null;
let activeRelayConfig: StreamRelayConfig | null = null;
let activeCaptureTitle = "";

export interface StreamRelayConfig {
  streamPlatform: string;
  streamUrl: string;
  streamKey: string;
}

export function isRelayRunning(): boolean {
  return ffmpegProc != null && ffmpegProc.exitCode == null;
}

function stopFfmpegProc(): void {
  if (!ffmpegProc) return;
  try {
    ffmpegProc.kill("SIGTERM");
  } catch {
    /* ignore */
  }
  ffmpegProc = null;
}

export function stopRtmpRelay(): void {
  stopFfmpegProc();
  activeRelayConfig = null;
  activeCaptureTitle = "";
  log("info", "[rtmp] Relay stopped");
}

/** Restart ffmpeg when WebRTC capture source changes mid-stream. */
export function syncRtmpCaptureSource(windowTitle: string): boolean {
  const title = windowTitle.trim();
  if (title === activeCaptureTitle) return false;
  activeCaptureTitle = title;
  // Empty title = session teardown; status:idle will stop the relay.
  if (!title || !activeRelayConfig || !isRelayRunning()) return false;

  stopFfmpegProc();
  const result = spawnRtmpRelay(activeRelayConfig, title || undefined);
  if (!result.ok) {
    log("warn", `[rtmp] Resync failed: ${result.error ?? "unknown"}`);
    activeRelayConfig = null;
    return false;
  }
  log("info", `[rtmp] Resynced capture source → ${buildGdigrabInput(title)}`);
  return true;
}

function spawnRtmpRelay(
  cfg: StreamRelayConfig,
  windowTitle?: string,
): { ok: boolean; error?: string } {
  const url = (cfg.streamUrl ?? "").trim();
  const key = (cfg.streamKey ?? "").trim();
  const outUrl = buildRtmpUrl(url, key);
  const grabInput = buildGdigrabInput(windowTitle);
  const args = [
    "-f",
    "gdigrab",
    "-framerate",
    "30",
    "-i",
    grabInput,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-tune",
    "zerolatency",
    "-pix_fmt",
    "yuv420p",
    "-f",
    "flv",
    outUrl,
  ];

  try {
    ffmpegProc = spawn("ffmpeg", args, { stdio: "ignore", windowsHide: true });
    ffmpegProc.on("exit", (code) => {
      log("info", `[rtmp] ffmpeg exited code=${code}`);
      ffmpegProc = null;
    });
    ffmpegProc.on("error", (err) => {
      log("error", `[rtmp] ffmpeg error: ${String(err)}`);
      ffmpegProc = null;
    });
    log(
      "info",
      `[rtmp] Relay started → ${cfg.streamPlatform || "custom"} (${url}) source=${grabInput}`,
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export function startRtmpRelay(
  cfg: StreamRelayConfig,
  opts?: { windowTitle?: string },
): { ok: boolean; error?: string } {
  if (process.platform !== "win32") {
    return { ok: false, error: "RTMP relay only supported on Windows" };
  }
  const url = (cfg.streamUrl ?? "").trim();
  const key = (cfg.streamKey ?? "").trim();
  if (!url || !key) {
    return { ok: false, error: "streamUrl and streamKey required" };
  }

  const title = (opts?.windowTitle ?? "").trim();
  activeRelayConfig = cfg;
  activeCaptureTitle = title;

  if (isRelayRunning()) {
    // Capture source may have changed since the relay started.
    stopFfmpegProc();
  }

  return spawnRtmpRelay(cfg, title || undefined);
}

export async function fetchStreamRelayConfig(
  hostToken: string,
  apiBaseUrl: string,
): Promise<StreamRelayConfig | null> {
  try {
    const base = apiBaseUrl.replace(/\/$/, "");
    const resp = await fetch(
      `${base}/api/hosts/me/stream-relay`,
      { headers: { "x-host-token": hostToken } },
    );
    if (!resp.ok) return null;
    const data = (await resp.json()) as StreamRelayConfig;
    if (!data.streamUrl || !data.streamKey) return null;
    return data;
  } catch {
    return null;
  }
}
