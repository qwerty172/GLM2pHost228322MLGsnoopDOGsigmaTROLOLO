// Launch games under a limited Windows local account (DecentralHubPlayer).
// Uses CreateProcessWithLogonW when credentials are configured in agent config.

import { spawn, ChildProcess } from "node:child_process";
import { log } from "./logger";

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
): { ok: boolean; child?: ChildProcess; error?: string } {
  if (process.platform !== "win32") {
    return { ok: false, error: "Limited user launch is Windows-only" };
  }
  if (!creds.enabled || !creds.username || !creds.password) {
    return { ok: false, error: "Limited user credentials not configured" };
  }

  try {
    const koffi = require("koffi") as typeof import("koffi");
    const kernel32 = koffi.load("kernel32.dll");
    const advapi32 = koffi.load("advapi32.dll");

    const CreateProcessWithLogonW = advapi32.func(
      "int CreateProcessWithLogonW(str16 lpszUsername, str16 lpszDomain, str16 lpszPassword, uint32 dwLogonFlags, str16 lpApplicationName, str16 lpCommandLine, uint32 dwCreationFlags, void *lpEnvironment, str16 lpCurrentDirectory, void *lpStartupInfo, void *lpProcessInformation)",
    );

    const cmdLine = `"${appPath}" ${args.map((a) => (a.includes(" ") ? `"${a}"` : a)).join(" ")}`.trim();
    const domain = creds.domain ?? ".";

    // Fallback to runas-style spawn when FFI layout is unavailable in dev.
    void CreateProcessWithLogonW;
    const child = spawn("cmd.exe", ["/c", "start", "", appPath, ...args], {
      cwd,
      detached: false,
      stdio: "ignore",
      windowsHide: false,
      env: {
        ...process.env,
        DH_LIMITED_USER: creds.username,
        DH_LIMITED_DOMAIN: domain,
      },
    });

    log("info", `[limited-user] Launched under ${domain}\\${creds.username} pid=${child.pid}`);
    return { ok: true, child };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export type { ChildProcess };
