// Cloud save restore/backup for host-agent (Windows).
// IPC: saves:restore(gameId, downloadUrl) before launch,
//       saves:backup(gameId, uploadUrl, storageKey) on session end.

import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { log } from "./logger";

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
