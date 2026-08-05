import { app } from "electron";

/** Application version from package.json / electron-builder — not a hardcoded string. */
export function getAgentVersion(): string {
  return app.getVersion();
}
