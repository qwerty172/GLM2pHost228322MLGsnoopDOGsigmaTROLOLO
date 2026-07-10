import type { Quota, hostsTable } from "@workspace/db";
import { computeHostTier, specsFromPcSpecs, STREAM_OVERHEAD } from "./hostTier";

// Shared "can this host attach to this quota" check — used by both the
// manual attach path (POST /sessions, host-picked quota) and the dev-key
// auto-attach path (POST /embed/sessions, key-linked quota). Keeping this in
// one place means both flows enforce identical game-binding and PC-spec
// rules; see hostTier.ts for the STREAM_OVERHEAD rationale.
export function checkQuotaAttachment(
  quota: Quota,
  host: typeof hostsTable.$inferSelect,
  resolvedGameId: string | null,
): { ok: true } | { ok: false; error: string } {
  if (quota.gameId && quota.gameId !== (resolvedGameId ?? host.gameId)) {
    return { ok: false, error: "Quota is bound to a different game" };
  }

  const specs = host.pcSpecs;
  if (!specs) return { ok: true };

  const hostSpecs = specsFromPcSpecs(specs);
  const minThresholds = {
    gpuVram: quota.minGpuVram,
    cpuCores: quota.minCpuCores,
    ramGb: quota.minRamGb,
    downloadMbps: quota.minDownloadMbps,
    uploadMbps: quota.minUploadMbps,
  };
  const recThresholds = {
    gpuVram: quota.recGpuVram,
    cpuCores: quota.recCpuCores,
    ramGb: quota.recRamGb,
    downloadMbps: quota.recDownloadMbps,
    uploadMbps: quota.recUploadMbps,
  };
  const tier = computeHostTier(hostSpecs, minThresholds, recThresholds);

  if (tier === "below_min") {
    const violations: string[] = [];
    if (quota.minGpuVram != null && hostSpecs.gpuVram != null && hostSpecs.gpuVram < quota.minGpuVram + STREAM_OVERHEAD.gpuVram) {
      violations.push(`GPU VRAM: хост ${hostSpecs.gpuVram} GB, минимум ${quota.minGpuVram} GB`);
    }
    if (quota.minCpuCores != null && hostSpecs.cpuCores != null && hostSpecs.cpuCores < quota.minCpuCores + STREAM_OVERHEAD.cpuCores) {
      violations.push(`CPU ядра: хост ${hostSpecs.cpuCores}, минимум ${quota.minCpuCores} (+${STREAM_OVERHEAD.cpuCores} на стриминг)`);
    }
    if (quota.minRamGb != null && hostSpecs.ramGb != null && hostSpecs.ramGb < quota.minRamGb + STREAM_OVERHEAD.ramGb) {
      violations.push(`RAM: хост ${hostSpecs.ramGb} GB, минимум ${quota.minRamGb} (+${STREAM_OVERHEAD.ramGb} на стриминг)`);
    }
    if (quota.minDownloadMbps != null && hostSpecs.downloadMbps != null && hostSpecs.downloadMbps < quota.minDownloadMbps) {
      violations.push(`Интернет: хост ${hostSpecs.downloadMbps} Мбит/с, минимум ${quota.minDownloadMbps} Мбит/с`);
    }
    if (quota.minUploadMbps != null && hostSpecs.uploadMbps != null && hostSpecs.uploadMbps < quota.minUploadMbps + STREAM_OVERHEAD.uploadMbps) {
      violations.push(`Аплоад: хост ${hostSpecs.uploadMbps} Мбит/с, минимум ${quota.minUploadMbps} (+${STREAM_OVERHEAD.uploadMbps} на стриминг)`);
    }
    return {
      ok: false,
      error: `ПК хоста (${specs.gpu}, ${specs.ramGb} GB RAM) ниже минимальных требований квоты: ${violations.join("; ")}`,
    };
  }
  if (quota.requiredTier === "recommended" && tier !== "above_rec") {
    return {
      ok: false,
      error: `Квота требует ПК уровня «выше рекомендуемых» — ПК хоста (${specs.gpu}, ${specs.ramGb} GB RAM) пока только на уровне минимальных требований`,
    };
  }
  return { ok: true };
}
