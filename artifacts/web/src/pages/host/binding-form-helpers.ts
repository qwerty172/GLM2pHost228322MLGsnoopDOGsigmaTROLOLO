import type { ScheduleSlot, UpdateHostConfigBody } from "@workspace/api-client-react";

export const DAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

export function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60).toString().padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function hhmmToMinutes(s: string): number {
  const [h, m] = s.split(":").map((v) => Number(v));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return Math.max(0, Math.min(1440, h * 60 + m));
}

export function resolveBindingKind(
  boundUrl: string | null | undefined,
  boundAppPath: string | null | undefined,
): "app" | "browser" {
  return (boundUrl ?? "").length > 0 && (boundAppPath ?? "").length === 0 ? "browser" : "app";
}

export function validatePrices(launchPriceUsd: string, minutePriceUsd: string): string | null {
  const lp = Number(launchPriceUsd);
  const mp = Number(minutePriceUsd);
  if (!Number.isFinite(lp) || Math.abs(lp) > 100) {
    return "Цена запуска: число, |значение| ≤ 100";
  }
  if (!Number.isFinite(mp) || Math.abs(mp) > 100) {
    return "Цена за минуту: число, |значение| ≤ 100";
  }
  return null;
}

export function validateScheduleSlots(
  scheduleMode: "always" | "scheduled",
  scheduleJson: ScheduleSlot[],
): string | null {
  if (scheduleMode !== "scheduled") return null;
  for (const slot of scheduleJson) {
    if (slot.startMin === slot.endMin) {
      return "Пустой слот расписания";
    }
    if (
      slot.startMin < 0 ||
      slot.startMin > 1439 ||
      slot.endMin < 0 ||
      slot.endMin > 1439
    ) {
      return "Время слота должно быть в диапазоне 00:00–23:59";
    }
  }
  return null;
}

export function validateBrowserUrl(url: string): string | null {
  const sendUrl = url.trim();
  if (!sendUrl) {
    return "Для браузерной игры нужен URL";
  }
  try {
    const u = new URL(sendUrl);
    if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("");
  } catch {
    return "URL должен начинаться с http:// или https://";
  }
  return null;
}

export function resolveBindingFields(
  bindingKind: "app" | "browser",
  boundAppPath: string,
  boundUrl: string,
): { sendAppPath: string; sendUrl: string } {
  const isBrowser = bindingKind === "browser";
  return {
    sendAppPath: isBrowser ? "" : boundAppPath,
    sendUrl: isBrowser ? boundUrl.trim() : "",
  };
}

export function computeDefaultAppLabel(
  isBrowser: boolean,
  sendUrl: string,
  sendAppPath: string,
): string {
  if (isBrowser) {
    try {
      return new URL(sendUrl).hostname;
    } catch {
      return "";
    }
  }
  return sendAppPath.split(/[\\/]/).pop() || "";
}

export function mergeTagsWithPending(tags: string[], tagsInput: string): string[] {
  const pendingTag = tagsInput.trim();
  return pendingTag ? [...tags, pendingTag] : tags;
}

export function resolveStreamKeyBody(
  clearStreamKey: boolean,
  streamKey: string,
): Pick<UpdateHostConfigBody, "streamKey"> | Record<string, never> {
  if (clearStreamKey) return { streamKey: "" };
  if (streamKey.length > 0) return { streamKey };
  return {};
}

export function buildBindingConfigBody(opts: {
  gameId: string | null;
  bindingKind: "app" | "browser";
  boundAppPath: string;
  boundUrl: string;
  boundAppLabel: string;
  description: string;
  tags: string[];
  tagsInput: string;
  launchPriceUsd: string;
  minutePriceUsd: string;
  scheduleMode: "always" | "scheduled";
  scheduleJson: ScheduleSlot[];
  streamPlatform: string;
  streamUrl: string;
  clearStreamKey: boolean;
  streamKey: string;
}): UpdateHostConfigBody {
  const isBrowser = opts.bindingKind === "browser";
  const { sendAppPath, sendUrl } = resolveBindingFields(
    opts.bindingKind,
    opts.boundAppPath,
    opts.boundUrl,
  );
  const defaultLabel = computeDefaultAppLabel(isBrowser, sendUrl, sendAppPath);
  const allTags = mergeTagsWithPending(opts.tags, opts.tagsInput);
  return {
    gameId: opts.gameId,
    boundAppPath: sendAppPath,
    boundUrl: sendUrl,
    boundAppLabel: opts.boundAppLabel || defaultLabel,
    description: opts.description,
    tags: allTags,
    launchPriceUsd: Number(opts.launchPriceUsd),
    minutePriceUsd: Number(opts.minutePriceUsd),
    scheduleMode: opts.scheduleMode,
    scheduleJson: opts.scheduleJson,
    streamPlatform: opts.streamPlatform,
    streamUrl: opts.streamUrl,
    ...resolveStreamKeyBody(opts.clearStreamKey, opts.streamKey),
  };
}
