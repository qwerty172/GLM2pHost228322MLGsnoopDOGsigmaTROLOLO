import { app } from "electron";
import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";

let logFile: string | null = null;

function ensureFile(): string {
  if (logFile) return logFile;
  const dir = path.join(app.getPath("userData"), "logs");
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
