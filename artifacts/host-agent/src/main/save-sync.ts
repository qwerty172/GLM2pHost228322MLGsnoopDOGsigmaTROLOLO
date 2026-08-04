// Save archive sync — pull from / push to platform object storage.

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import {
  confirmSaveUpload,
  requestSaveDownloadUrl,
  requestSaveUploadUrl,
} from "./api-client";
import { log } from "./logger";
import {
  discoverSavePaths,
  resolveSavePathCandidates,
  type DiscoverSavePathsOpts,
} from "./save-paths";

import type { SaveSyncResult } from "../shared/messages";

/** Bumped on each pull/push start so in-flight pushes cannot clear paths after a newer sync. */
let saveSyncGeneration = 0;

export function bumpSaveSyncGeneration(): number {
  saveSyncGeneration += 1;
  return saveSyncGeneration;
}

export function getSaveSyncGeneration(): number {
  return saveSyncGeneration;
}

async function listFilesRecursive(root: string): Promise<string[]> {
  const files: string[] = [];
  let stat;
  try {
    stat = await fs.stat(root);
  } catch {
    return files;
  }

  if (stat.isFile()) {
    return [root];
  }

  if (!stat.isDirectory()) return files;

  const entries = await fs.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(full)));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

async function clearPath(target: string): Promise<void> {
  let stat;
  try {
    stat = await fs.stat(target);
  } catch {
    return;
  }

  if (stat.isDirectory()) {
    await fs.rm(target, { recursive: true, force: true });
    await fs.mkdir(target, { recursive: true });
    return;
  }

  await fs.unlink(target);
}

export async function clearSavePaths(paths: string[]): Promise<void> {
  for (const target of paths) {
    await clearPath(target);
  }
}

async function zipSavePaths(paths: string[]): Promise<Buffer | null> {
  const zip = new AdmZip();
  let count = 0;

  for (const root of paths) {
    const files = await listFilesRecursive(root);
    for (const filePath of files) {
      zip.addFile(filePath, await fs.readFile(filePath));
      count++;
    }
  }

  if (count === 0) return null;
  return zip.toBuffer();
}

async function extractSaveZip(buffer: Buffer, targetPaths: string[]): Promise<void> {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  if (entries.length === 0) return;

  await clearSavePaths(targetPaths);

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const entryName = entry.entryName.replace(/\//g, path.sep);
    const absolutePath = path.isAbsolute(entryName)
      ? path.normalize(entryName)
      : path.normalize(path.join(process.cwd(), entryName));
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, entry.getData());
  }
}

export async function pullSave(opts: {
  hostToken: string;
  apiBaseUrl: string;
  sessionId: string;
  saveOpts: DiscoverSavePathsOpts;
}): Promise<SaveSyncResult> {
  bumpSaveSyncGeneration();
  const { paths: existingPaths } = await discoverSavePaths(opts.saveOpts);
  const { paths: candidatePaths } = await resolveSavePathCandidates(opts.saveOpts);

  if (candidatePaths.length === 0) {
    return { ok: true, skipped: true, reason: "no_save_paths" };
  }

  const download = await requestSaveDownloadUrl(
    opts.hostToken,
    opts.apiBaseUrl,
    opts.sessionId,
  );
  if (download.status === 404) {
    return { ok: true, skipped: true, reason: "no_cloud_save" };
  }
  if (!download.ok || !download.downloadURL) {
    return {
      ok: true,
      skipped: true,
      reason: download.error ?? "download_unavailable",
    };
  }

  try {
    const resp = await fetch(download.downloadURL);
    if (!resp.ok) {
      return { ok: false, error: `Download failed: HTTP ${resp.status}` };
    }
    const buffer = Buffer.from(await resp.arrayBuffer());
    await extractSaveZip(buffer, candidatePaths.length > 0 ? candidatePaths : existingPaths);
    log("info", `[save-sync] Restored save for session ${opts.sessionId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function pushSave(opts: {
  hostToken: string;
  apiBaseUrl: string;
  sessionId: string;
  saveOpts: DiscoverSavePathsOpts;
}): Promise<SaveSyncResult> {
  const startGeneration = bumpSaveSyncGeneration();
  const { paths } = await discoverSavePaths(opts.saveOpts);
  const { paths: candidatePaths } = await resolveSavePathCandidates(opts.saveOpts);
  const syncPaths = paths.length > 0 ? paths : candidatePaths;

  if (syncPaths.length === 0) {
    return { ok: true, skipped: true, reason: "no_save_paths" };
  }

  const archive = await zipSavePaths(syncPaths);
  if (!archive || archive.length === 0) {
    return { ok: true, skipped: true, reason: "empty_save" };
  }

  const uploadMeta = await requestSaveUploadUrl(
    opts.hostToken,
    opts.apiBaseUrl,
    opts.sessionId,
    archive.length,
  );
  if (!uploadMeta.ok || !uploadMeta.uploadURL) {
    return {
      ok: true,
      skipped: true,
      reason: uploadMeta.error ?? "upload_unavailable",
    };
  }

  try {
    const putResp = await fetch(uploadMeta.uploadURL, {
      method: "PUT",
      headers: { "Content-Type": "application/zip" },
      body: new Uint8Array(archive),
    });
    if (!putResp.ok) {
      return { ok: false, error: `Upload failed: HTTP ${putResp.status}` };
    }

    if (startGeneration !== getSaveSyncGeneration()) {
      return { ok: false, error: "stale_push" };
    }

    const contentHash = createHash("sha256").update(archive).digest("hex");
    const confirmed = await confirmSaveUpload(
      opts.hostToken,
      opts.apiBaseUrl,
      opts.sessionId,
      contentHash,
      archive.length,
    );
    if (!confirmed.ok) {
      return { ok: false, error: confirmed.error ?? "confirm_failed" };
    }

    if (startGeneration !== getSaveSyncGeneration()) {
      return { ok: false, error: "stale_push" };
    }

    await clearSavePaths(syncPaths);
    log("info", `[save-sync] Uploaded save for session ${opts.sessionId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ── Manifest-based restore/backup (security-ux-infra) ──────────────────────
import os from "node:os";

export type SaveManifestEntry = {
  label: string;
  pathTemplate: string;
  provider: "steam" | "custom";
};

function expandPathTemplate(template: string): string {
  const profile = process.env.USERPROFILE ?? os.homedir();
  return template
    .replace(/%USERPROFILE%/gi, profile)
    .replace(/\//g, path.sep);
}

async function downloadToFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(dest, buf);
}

async function uploadFile(url: string, filePath: string, contentType: string): Promise<void> {
  const buf = await fs.readFile(filePath);
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: buf,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
}

/** Restore save files from a remote zip URL into local paths. */
export async function restoreSave(
  manifest: SaveManifestEntry[],
  downloadUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  if (process.platform !== "win32") {
    return { ok: false, error: "Save sync supported on Windows only" };
  }
  const tmpDir = path.join(os.tmpdir(), "dh-save-restore");
  const zipPath = path.join(tmpDir, "restore.zip");
  try {
    await fs.mkdir(tmpDir, { recursive: true });
    await downloadToFile(downloadUrl, zipPath);
    // MVP: extract is host-side manual path copy — unzip via PowerShell
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);
    await execFileAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        `Expand-Archive -Force -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${tmpDir.replace(/'/g, "''")}'`,
      ],
      { timeout: 120_000 },
    );
    for (const entry of manifest) {
      const target = expandPathTemplate(entry.pathTemplate);
      const baseName = path.basename(target);
      const extracted = path.join(tmpDir, baseName);
      try {
        await fs.access(extracted);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.copyFile(extracted, target);
        log("info", `[save-sync] Restored ${entry.label} → ${target}`);
      } catch {
        log("warn", `[save-sync] Missing ${baseName} in archive — skipped`);
      }
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Backup local save paths into a zip and upload via presigned URL. */
export async function backupSave(
  manifest: SaveManifestEntry[],
  uploadUrl: string,
): Promise<{ ok: boolean; sizeBytes?: number; error?: string }> {
  if (process.platform !== "win32") {
    return { ok: false, error: "Save sync supported on Windows only" };
  }
  const tmpDir = path.join(os.tmpdir(), "dh-save-backup");
  const zipPath = path.join(tmpDir, "backup.zip");
  try {
    await fs.mkdir(tmpDir, { recursive: true });
    const staging = path.join(tmpDir, "files");
    await fs.mkdir(staging, { recursive: true });
    for (const entry of manifest) {
      const src = expandPathTemplate(entry.pathTemplate);
      try {
        await fs.access(src);
        await fs.copyFile(src, path.join(staging, path.basename(src)));
      } catch {
        log("warn", `[save-sync] Save not found: ${src}`);
      }
    }
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);
    await execFileAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        `Compress-Archive -Force -Path '${staging.replace(/'/g, "''")}\\*' -DestinationPath '${zipPath.replace(/'/g, "''")}'`,
      ],
      { timeout: 120_000 },
    );
    const stat = await fs.stat(zipPath);
    await uploadFile(uploadUrl, zipPath, "application/zip");
    log("info", `[save-sync] Backup uploaded (${stat.size} bytes)`);
    return { ok: true, sizeBytes: stat.size };
  } catch (err) {
    return { ok: false, error: String(err) };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
