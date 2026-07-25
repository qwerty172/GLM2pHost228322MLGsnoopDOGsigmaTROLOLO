// Parse Steam Store pc_requirements HTML into numeric tier thresholds.

import { BASELINE_REC } from "./hostTier";
import type { TierThresholds } from "./hostTier";

export interface ParsedSteamSpecs {
  min: TierThresholds;
  rec: TierThresholds;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(text: string, patterns: RegExp[]): number | null {
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n)) return n;
    }
  }
  return null;
}

function parseRequirementsBlock(html: string | undefined): TierThresholds {
  if (!html) {
    return {
      gpuVram: null,
      cpuCores: null,
      ramGb: null,
      downloadMbps: null,
      uploadMbps: null,
    };
  }

  const text = stripHtml(html);

  const gpuVram =
    parseNumber(text, [
      /(\d+)\s*GB\s*(?:video|VRAM|graphics)/i,
      /Graphics:.*?(\d+)\s*GB/i,
      /GPU:.*?(\d+)\s*GB/i,
    ]) ??
    parseNumber(text, [/(\d+)\s*GB/i]);

  const ramGb = parseNumber(text, [
    /Memory:.*?(\d+)\s*GB/i,
    /RAM:.*?(\d+)\s*GB/i,
    /(\d+)\s*GB\s*RAM/i,
  ]);

  const cpuCores = parseNumber(text, [
    /(\d+)[- ]?(?:core|Core|CPU)/i,
    /Processor:.*?(\d+)/i,
  ]);

  return {
    gpuVram,
    cpuCores,
    ramGb,
    downloadMbps: null,
    uploadMbps: null,
  };
}

export function parseSteamPcRequirements(data: {
  pc_requirements?: {
    minimum?: string;
    recommended?: string;
  };
}): ParsedSteamSpecs {
  const min = parseRequirementsBlock(data.pc_requirements?.minimum);
  const recRaw = parseRequirementsBlock(data.pc_requirements?.recommended);

  const rec: TierThresholds = {
    gpuVram: recRaw.gpuVram ?? min.gpuVram ?? BASELINE_REC.gpuVram,
    cpuCores: recRaw.cpuCores ?? min.cpuCores ?? BASELINE_REC.cpuCores,
    ramGb: recRaw.ramGb ?? min.ramGb ?? BASELINE_REC.ramGb,
    downloadMbps: recRaw.downloadMbps ?? BASELINE_REC.downloadMbps,
    uploadMbps: recRaw.uploadMbps ?? BASELINE_REC.uploadMbps,
  };

  return { min, rec };
}

export function recSpecsToJson(rec: TierThresholds): {
  gpuVram?: number | null;
  cpuCores?: number | null;
  ramGb?: number | null;
  downloadMbps?: number | null;
  uploadMbps?: number | null;
} {
  return {
    gpuVram: rec.gpuVram ?? null,
    cpuCores: rec.cpuCores ?? null,
    ramGb: rec.ramGb ?? null,
    downloadMbps: rec.downloadMbps ?? null,
    uploadMbps: rec.uploadMbps ?? null,
  };
}
