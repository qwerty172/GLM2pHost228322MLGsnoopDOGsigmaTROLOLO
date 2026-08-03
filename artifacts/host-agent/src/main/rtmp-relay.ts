// Optional RTMP restream sidecar via ffmpeg (Windows gdigrab → ingest URL).
// Started when the host goes online and stream relay is configured on the server.

import { spawn, type ChildProcess } from "node:child_process";
import { log } from "./logger";

let ffmpegProc: ChildProcess | null = null;
let activeRelayConfig: StreamRelayConfig | null = null;

export interface StreamRelayConfig {
  streamPlatform: string;
  streamUrl: string;
  streamKey: string;
}

export function isRelayRunning(): boolean {
  return ffmpegProc != null && ffmpegProc.exitCode == null;
}

export function stopRtmpRelay(): void {
  if (!ffmpegProc) return;
  try {
    ffmpegProc.kill("SIGTERM");
  } catch {
    /* ignore */
  }
  ffmpegProc = null;
  activeRelayConfig = null;
  log("info", "[rtmp] Relay stopped");
}

function buildRtmpUrl(streamUrl: string, streamKey: string): string {
  const base = streamUrl.replace(/\/$/, "");
  if (base.includes("{stream_key}")) {
    return base.replace("{stream_key}", streamKey);
  }
  return `${base}/${streamKey}`;
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
  if (isRelayRunning()) {
    return { ok: true };
  }

  activeRelayConfig = cfg;
  const outUrl = buildRtmpUrl(url, key);
  // Prefer the same window title WebRTC is capturing; fall back to full desktop.
  const title = (opts?.windowTitle ?? "").trim();
  const grabInput = title
    ? `title=${title.replace(/[=:,]/g, " ")}`
    : "desktop";
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
      activeRelayConfig = null;
    });
    ffmpegProc.on("error", (err) => {
      log("error", `[rtmp] ffmpeg error: ${String(err)}`);
      ffmpegProc = null;
      activeRelayConfig = null;
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

/** Restart ffmpeg when WebRTC capture target changes so RTMP stays in sync. */
export function syncRtmpWindowTitle(windowTitle: string): void {
  const cfg = activeRelayConfig;
  if (!cfg || !isRelayRunning()) return;
  const title = windowTitle.trim();
  if (!title) {
    // Session teardown clears the capture title — stop relay instead of
    // briefly restreaming the full desktop to the ingest URL.
    stopRtmpRelay();
    return;
  }
  log("info", `[rtmp] Sync capture title → "${title}"`);
  stopRtmpRelay();
  startRtmpRelay(cfg, { windowTitle: title });
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
