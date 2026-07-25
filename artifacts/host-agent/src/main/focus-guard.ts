// Input focus guard — only inject player input when the launched game (or its
// child processes) owns the foreground window. Prevents remote players from
// controlling arbitrary windows on the host desktop.

import { log } from "./logger";

export interface FocusGuardStatus {
  /** Guard is configured (allowedPid set or guard explicitly disabled). */
  active: boolean;
  /** Root PID of the launched game process (null for browser-URL launches). */
  allowedPid: number | null;
  /** Guard disabled (browser games) — input always allowed unless panic-blocked. */
  guardDisabled: boolean;
  /** Foreground window belongs to allowed process tree. */
  foregroundAllowed: boolean;
  /** Panic hotkey or manual block — all input denied. */
  inputBlocked: boolean;
}

let allowedPid: number | null = null;
let guardDisabled = false;
let inputBlocked = false;
let lastDenyLogAt = 0;

type Win32Guard = {
  getForegroundPid: () => number | null;
  isPidAllowed: (foregroundPid: number, rootPid: number) => boolean;
};

let win32: Win32Guard | null = null;

function initWin32(): Win32Guard | null {
  if (process.platform !== "win32") return null;
  if (win32) return win32;
  try {
    const koffi = require("koffi") as typeof import("koffi");
    const user32 = koffi.load("user32.dll");
    const kernel32 = koffi.load("kernel32.dll");

    const GetForegroundWindow = user32.func("void *GetForegroundWindow()");
    const GetWindowThreadProcessId = user32.func(
      "uint32 GetWindowThreadProcessId(void *hWnd, uint32 *lpdwProcessId)",
    );
    const CreateToolhelp32Snapshot = kernel32.func(
      "void *CreateToolhelp32Snapshot(uint32 dwFlags, uint32 th32ProcessID)",
    );
    const Process32First = kernel32.func(
      "int Process32First(void *hSnapshot, void *lppe)",
    );
    const Process32Next = kernel32.func(
      "int Process32Next(void *hSnapshot, void *lppe)",
    );
    const CloseHandle = kernel32.func("int CloseHandle(void *hObject)");

    const TH32CS_SNAPPROCESS = 0x00000002;

    const PROCESSENTRY32 = koffi.struct("PROCESSENTRY32", {
      dwSize: "uint32",
      cntUsage: "uint32",
      th32ProcessID: "uint32",
      th32DefaultHeapID: "uintptr_t",
      th32ModuleID: "uint32",
      cntThreads: "uint32",
      th32ParentProcessID: "uint32",
      pcPriClassBase: "int32",
      dwFlags: "uint32",
      szExeFile: koffi.array("char", 260),
    });

    function getForegroundPid(): number | null {
      const hwnd = GetForegroundWindow();
      if (!hwnd) return null;
      const pidBuf = Buffer.alloc(4);
      GetWindowThreadProcessId(hwnd, pidBuf);
      const pid = pidBuf.readUInt32LE(0);
      return pid > 0 ? pid : null;
    }

    function buildParentMap(): Map<number, number> {
      const map = new Map<number, number>();
      const snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
      if (!snapshot) return map;
      try {
        const entry = {
          dwSize: koffi.sizeof(PROCESSENTRY32),
          cntUsage: 0,
          th32ProcessID: 0,
          th32DefaultHeapID: 0,
          th32ModuleID: 0,
          cntThreads: 0,
          th32ParentProcessID: 0,
          pcPriClassBase: 0,
          dwFlags: 0,
          szExeFile: new Array(260).fill(0),
        };
        if (Process32First(snapshot, entry)) {
          do {
            map.set(entry.th32ProcessID, entry.th32ParentProcessID);
          } while (Process32Next(snapshot, entry));
        }
      } finally {
        CloseHandle(snapshot);
      }
      return map;
    }

    function isDescendantOf(childPid: number, rootPid: number): boolean {
      if (childPid === rootPid) return true;
      const parents = buildParentMap();
      let cur = childPid;
      const seen = new Set<number>();
      while (cur > 0 && !seen.has(cur)) {
        seen.add(cur);
        if (cur === rootPid) return true;
        const parent = parents.get(cur);
        if (parent === undefined || parent === 0) break;
        cur = parent;
      }
      return false;
    }

    win32 = {
      getForegroundPid,
      isPidAllowed: (foregroundPid, rootPid) =>
        isDescendantOf(foregroundPid, rootPid),
    };
    return win32;
  } catch (err) {
    log("warn", `Focus guard Win32 init failed: ${String(err)}`);
    return null;
  }
}

export function setAllowedTarget(
  pid: number | null,
  opts?: { guardDisabled?: boolean },
): void {
  allowedPid = pid;
  guardDisabled = opts?.guardDisabled ?? false;
  log(
    "info",
    `[focus-guard] allowedPid=${pid ?? "none"} guardDisabled=${guardDisabled}`,
  );
}

export function clearAllowedTarget(): void {
  allowedPid = null;
  guardDisabled = false;
  log("info", "[focus-guard] cleared");
}

export function setInputBlocked(blocked: boolean): void {
  inputBlocked = blocked;
  log("info", `[focus-guard] inputBlocked=${blocked}`);
}

export function isInputBlocked(): boolean {
  return inputBlocked;
}

export function isInputAllowed(): boolean {
  if (inputBlocked) return false;
  if (guardDisabled || allowedPid === null) return true;

  if (process.platform !== "win32") return true;

  const w = initWin32();
  if (!w) return true;

  const fgPid = w.getForegroundPid();
  if (fgPid === null) return false;
  return w.isPidAllowed(fgPid, allowedPid);
}

export function getFocusGuardStatus(): FocusGuardStatus {
  let foregroundAllowed = true;
  if (inputBlocked) {
    foregroundAllowed = false;
  } else if (!guardDisabled && allowedPid !== null) {
    foregroundAllowed = isInputAllowed();
  }

  return {
    active: allowedPid !== null || guardDisabled,
    allowedPid,
    guardDisabled,
    foregroundAllowed,
    inputBlocked,
  };
}

function rateLimitedDenyLog(): void {
  const now = Date.now();
  if (now - lastDenyLogAt < 2000) return;
  lastDenyLogAt = now;
  log("warn", "[focus-guard] Input denied — game not in foreground");
}

export function guardInput<T>(fn: () => T): T | undefined {
  if (!isInputAllowed()) {
    rateLimitedDenyLog();
    return undefined;
  }
  return fn();
}
