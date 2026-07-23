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

    await clearSavePaths(syncPaths);
    log("info", `[save-sync] Uploaded save for session ${opts.sessionId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
