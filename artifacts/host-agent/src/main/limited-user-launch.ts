// Launch games under a limited Windows local account (DecentralHubPlayer).
// Uses CreateProcessWithLogonW when credentials are configured in agent config.

import type { ChildProcess } from "node:child_process";

export interface LimitedUserConfig {
  enabled: boolean;
  username: string;
  password: string;
  domain?: string;
}

export function launchWithLimitedUser(
  appPath: string,
  args: string[],
  cwd: string,
  creds: LimitedUserConfig,
): { ok: boolean; pid?: number; error?: string } {
  if (process.platform !== "win32") {
    return { ok: false, error: "Limited user launch is Windows-only" };
  }
  if (!creds.enabled || !creds.username || !creds.password) {
    return { ok: false, error: "Limited user credentials not configured" };
  }

  // CreateProcessWithLogonW FFI is not wired yet — fail closed so the agent
  // does not claim sandbox isolation or watch the wrong (cmd.exe) PID.
  return {
    ok: false,
    error: "CreateProcessWithLogonW limited-user launch is not implemented",
  };
}

export type { ChildProcess };
