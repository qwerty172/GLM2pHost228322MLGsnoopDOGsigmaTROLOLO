/** Pure helpers for ffmpeg RTMP relay (no Electron deps — safe for unit tests). */

export function buildGdigrabInput(windowTitle?: string): string {
  const title = (windowTitle ?? "").trim();
  return title
    ? `title=${title.replace(/[=:,]/g, " ")}`
    : "desktop";
}

export function buildRtmpUrl(streamUrl: string, streamKey: string): string {
  const base = streamUrl.replace(/\/$/, "");
  if (base.includes("{stream_key}")) {
    return base.replace("{stream_key}", streamKey);
  }
  return `${base}/${streamKey}`;
}
