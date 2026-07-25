import { app } from "electron";
import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";

let logFile: string | null = null;

function ensureFile(): string {
  if (logFile) return logFile;
  // Write agent.log next to start.bat (the extracted zip root) so users can
  // find it without digging through %APPDATA%. app.getAppPath() returns the
  // directory that contains package.json, which is the zip root when launched
  // via "electron ." from start.bat.
  const dir = path.join(app.getAppPath(), "logs");
  mkdirSync(dir, { recursive: true });
  logFile = path.join(dir, "agent.log");
  return logFile;
}

export function log(
  level: "info" | "warn" | "error",
  message: string,
): void {
  const line = `${new Date().toISOString()} [${level}] ${message}\n`;
  try {
    appendFileSync(ensureFile(), line);
  } catch {
    // Fallback: stderr only
  }
  if (level === "error") console.error(line.trim());
  else console.log(line.trim());
}
