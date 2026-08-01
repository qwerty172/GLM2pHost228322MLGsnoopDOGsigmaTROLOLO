// Launch games under a limited Windows local account (DecentralHubPlayer).
// Uses CreateProcessWithLogonW when credentials are configured in agent config.

import { EventEmitter } from "node:events";
import { log } from "./logger";

export interface LimitedUserConfig {
  enabled: boolean;
  username: string;
  password: string;
  domain?: string;
}

/** Minimal process handle used by app-launcher (spawn ChildProcess or WinProcessHandle). */
export interface ManagedProcess {
  pid?: number;
  exitCode: number | null;
  on(
    event: "exit",
    listener: (code: number | null, signal: NodeJS.Signals | null) => void,
  ): ManagedProcess;
  on(event: "error", listener: (err: Error) => void): ManagedProcess;
  kill(): void;
}

export interface LimitedLaunchResult {
  ok: boolean;
  pid?: number;
  error?: string;
  process?: ManagedProcess;
}

const LOGON_WITH_PROFILE = 0x00000001;
const STILL_ACTIVE = 259;

class WinProcessHandle extends EventEmitter implements ManagedProcess {
  exitCode: number | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    readonly pid: number,
    private hProcess: unknown,
    private closeHandle: (h: unknown) => void,
    private readExitCode: (h: unknown) => number,
    private terminate: (h: unknown) => void,
  ) {
    super();
    this.pollTimer = setInterval(() => this.checkExit(), 500);
    this.pollTimer.unref?.();
  }

  private checkExit(): void {
    if (this.exitCode !== null) return;
    const code = this.readExitCode(this.hProcess);
    if (code !== STILL_ACTIVE) {
      this.exitCode = code;
      if (this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
      this.closeHandle(this.hProcess);
      this.emit("exit", code, null);
    }
  }

  kill(): void {
    try {
      this.terminate(this.hProcess);
    } catch (err) {
      this.emit("error", err instanceof Error ? err : new Error(String(err)));
    }
  }
}

function quoteArg(arg: string): string {
  if (arg.includes(" ") || arg.includes("\t") || arg.includes('"')) {
    return `"${arg.replace(/"/g, '\\"')}"`;
  }
  return arg;
}

export function launchWithLimitedUser(
  appPath: string,
  args: string[],
  cwd: string,
  creds: LimitedUserConfig,
): LimitedLaunchResult {
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

    const STARTUPINFOW = koffi.struct("STARTUPINFOW", {
      cb: "uint32",
      lpReserved: "uint16 *",
      lpDesktop: "uint16 *",
      lpTitle: "uint16 *",
      dwX: "uint32",
      dwY: "uint32",
      dwXSize: "uint32",
      dwYSize: "uint32",
      dwXCountChars: "uint32",
      dwYCountChars: "uint32",
      dwFillAttribute: "uint32",
      dwFlags: "uint32",
      wShowWindow: "uint16",
      cbReserved2: "uint16",
      lpReserved2: "uint8 *",
      hStdInput: "void *",
      hStdOutput: "void *",
      hStdError: "void *",
    });

    const PROCESS_INFORMATION = koffi.struct("PROCESS_INFORMATION", {
      hProcess: "void *",
      hThread: "void *",
      dwProcessId: "uint32",
      dwThreadId: "uint32",
    });

    const CreateProcessWithLogonW = advapi32.func(
      "bool CreateProcessWithLogonW(str16 username, str16 domain, str16 password, uint32 logonFlags, str16 appName, str16 cmdLine, uint32 creationFlags, void *env, str16 cwd, STARTUPINFOW *si, PROCESS_INFORMATION *pi)",
    );
    const GetExitCodeProcess = kernel32.func(
      "bool GetExitCodeProcess(void *hProcess, uint32 *exitCode)",
    );
    const CloseHandle = kernel32.func("bool CloseHandle(void *hObject)");
    const TerminateProcess = kernel32.func(
      "bool TerminateProcess(void *hProcess, uint32 exitCode)",
    );
    const GetLastError = kernel32.func("uint32 GetLastError()");

    const cmdLine = [appPath, ...args].map(quoteArg).join(" ");
    const domain = creds.domain?.trim() || ".";

    const si = {
      cb: koffi.sizeof(STARTUPINFOW),
      lpReserved: null,
      lpDesktop: null,
      lpTitle: null,
      dwX: 0,
      dwY: 0,
      dwXSize: 0,
      dwYSize: 0,
      dwXCountChars: 0,
      dwYCountChars: 0,
      dwFillAttribute: 0,
      dwFlags: 0,
      wShowWindow: 0,
      cbReserved2: 0,
      lpReserved2: null,
      hStdInput: null,
      hStdOutput: null,
      hStdError: null,
    };

    const pi = {
      hProcess: null,
      hThread: null,
      dwProcessId: 0,
      dwThreadId: 0,
    };

    const ok = CreateProcessWithLogonW(
      creds.username,
      domain,
      creds.password,
      LOGON_WITH_PROFILE,
      appPath,
      cmdLine,
      0,
      null,
      cwd,
      si,
      pi,
    );

    if (!ok) {
      const errCode = GetLastError();
      return {
        ok: false,
        error: `CreateProcessWithLogonW failed (Win32 error ${errCode})`,
      };
    }

    if (pi.hThread) CloseHandle(pi.hThread);

    const pid = pi.dwProcessId;
    const hProcess = pi.hProcess;

    function readExitCode(h: unknown): number {
      const buf = Buffer.alloc(4);
      GetExitCodeProcess(h, buf);
      return buf.readUInt32LE(0);
    }

    const proc = new WinProcessHandle(
      pid,
      hProcess,
      (h) => CloseHandle(h),
      readExitCode,
      (h) => TerminateProcess(h, 1),
    );

    log(
      "info",
      `[limited-user] Launched under ${domain}\\${creds.username} pid=${pid}`,
    );
    return { ok: true, pid, process: proc };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
