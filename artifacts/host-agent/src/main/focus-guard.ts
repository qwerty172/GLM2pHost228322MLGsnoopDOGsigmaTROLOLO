// Input focus guard — only inject player input when the launched game (or its
// child processes) owns the foreground window. Prevents remote players from
// controlling arbitrary windows on the host desktop.

import { log } from "./logger";
import { isBrowserExeName } from "./browser-exe-names";

export { isBrowserExeName, BROWSER_EXE_NAMES } from "./browser-exe-names";

export interface FocusGuardStatus {
  /** Guard is configured (allowedPid set or browser guard active). */
  active: boolean;
  /** Root PID of the launched game process (null for browser-URL launches). */
  allowedPid: number | null;
  /** Browser-game guard: only allow input when a browser owns the foreground. */
  browserGuard: boolean;
  /** Foreground window belongs to allowed process tree / browser. */
  foregroundAllowed: boolean;
  /** Panic hotkey or manual block — all input denied. */
  inputBlocked: boolean;
}
let allowedPid: number | null = null;
let browserGuard = false;
let inputBlocked = false;
let lastDenyLogAt = 0;

type Win32Guard = {
  getForegroundPid: () => number | null;
  getExeNameForPid: (pid: number) => string | null;
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

    function buildProcessMaps(): {
      parents: Map<number, number>;
      exeNames: Map<number, string>;
    } {
      const parents = new Map<number, number>();
      const exeNames = new Map<number, string>();
      const snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
      if (!snapshot) return { parents, exeNames };
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
            parents.set(entry.th32ProcessID, entry.th32ParentProcessID);
            const raw = Buffer.from(entry.szExeFile as number[]);
            const nul = raw.indexOf(0);
            const name = raw
              .subarray(0, nul >= 0 ? nul : raw.length)
              .toString("utf8")
              .trim();
            if (name) exeNames.set(entry.th32ProcessID, name);
          } while (Process32Next(snapshot, entry));
        }
      } finally {
        CloseHandle(snapshot);
      }
      return { parents, exeNames };
    }

    function isDescendantOf(
      childPid: number,
      rootPid: number,
      parents: Map<number, number>,
    ): boolean {
      if (childPid === rootPid) return true;
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
      getExeNameForPid: (pid) => {
        const { exeNames } = buildProcessMaps();
        return exeNames.get(pid) ?? null;
      },
      isPidAllowed: (foregroundPid, rootPid) => {
        const { parents } = buildProcessMaps();
        return isDescendantOf(foregroundPid, rootPid, parents);
      },
    };
    return win32;
  } catch (err) {
    log("warn", `Focus guard Win32 init failed: ${String(err)}`);
    return null;
  }
}

export function setAllowedTarget(
  pid: number | null,
  opts?: { browserGuard?: boolean },
): void {
  allowedPid = pid;
  browserGuard = opts?.browserGuard ?? false;
  log(
    "info",
    `[focus-guard] allowedPid=${pid ?? "none"} browserGuard=${browserGuard}`,
  );
}

export function clearAllowedTarget(): void {
  allowedPid = null;
  browserGuard = false;
  log("info", "[focus-guard] cleared");
}

export function setInputBlocked(blocked: boolean): void {
  inputBlocked = blocked;
  log("info", `[focus-guard] inputBlocked=${blocked}`);
}

export function isInputBlocked(): boolean {
  return inputBlocked;
}

function isForegroundBrowser(): boolean {
  if (process.platform !== "win32") return true;

  const w = initWin32();
  if (!w) return false;

  const fgPid = w.getForegroundPid();
  if (fgPid === null) return false;

  const exeName = w.getExeNameForPid(fgPid);
  if (!exeName) return false;
  return isBrowserExeName(exeName);
}

export function isInputAllowed(): boolean {
  if (inputBlocked) return false;

  if (browserGuard) {
    return isForegroundBrowser();
  }

  if (allowedPid === null) return true;

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
  } else if (browserGuard || allowedPid !== null) {
    foregroundAllowed = isInputAllowed();
  }

  return {
    active: allowedPid !== null || browserGuard,
    allowedPid,
    browserGuard,
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
