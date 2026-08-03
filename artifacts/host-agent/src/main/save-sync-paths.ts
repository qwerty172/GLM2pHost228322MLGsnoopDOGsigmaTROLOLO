import { promises as fs } from "node:fs";
import path from "node:path";

// Cloud save zips are produced/consumed on Windows hosts — use win32 semantics.
const win32 = path.win32;

/** True when `candidate` equals `root` or is a descendant of `root`. */
export function isPathWithinRoot(candidate: string, root: string): boolean {
  const resolvedCandidate = win32.resolve(candidate);
  const resolvedRoot = win32.resolve(root);
  if (resolvedCandidate === resolvedRoot) return true;
  const rel = win32.relative(resolvedRoot, resolvedCandidate);
  return rel !== "" && !rel.startsWith("..") && !win32.isAbsolute(rel);
}

/** Directory roots where save zip entries may be written. */
export async function getAllowedSaveRoots(targetPaths: string[]): Promise<string[]> {
  const roots = new Set<string>();
  for (const target of targetPaths) {
    const resolved = win32.resolve(target);
    try {
      const stat = await fs.stat(resolved);
      roots.add(stat.isDirectory() ? resolved : win32.dirname(resolved));
    } catch {
      roots.add(win32.extname(resolved) ? win32.dirname(resolved) : resolved);
    }
  }
  return [...roots];
}

/**
 * Map a zip entry name to a safe absolute path under allowed save roots.
 * Returns null when the entry would escape the allowed directories.
 */
export function resolveSafeExtractTarget(
  entryName: string,
  allowedRoots: string[],
): string | null {
  if (!entryName || entryName.includes("\0")) return null;

  const normalizedEntry = entryName.replace(/\//g, "\\");

  if (win32.isAbsolute(normalizedEntry)) {
    const resolved = win32.normalize(normalizedEntry);
    for (const root of allowedRoots) {
      if (isPathWithinRoot(resolved, root)) return resolved;
    }
    return null;
  }

  for (const root of allowedRoots) {
    const candidate = win32.normalize(win32.join(root, normalizedEntry));
    if (isPathWithinRoot(candidate, root)) return candidate;
  }
  return null;
}
