// HWND-based capture matching for a spawned native game (HOSTING H-08).
// Enumerates top-level windows owned by the launched process tree and maps
// them to Electron desktopCapturer source ids (`window:<hwnd>:0`).

import type { CaptureSource } from "../shared/window-match";
import { findCaptureSourceByHwnds } from "../shared/window-match";
import { log } from "./logger";

type Win32SpawnMatch = {
  findProcessWindowHwnds: (rootPid: number) => number[];
};

let win32: Win32SpawnMatch | null = null;

function initWin32(): Win32SpawnMatch | null {
  if (process.platform !== "win32") return null;
  if (win32) return win32;
  try {
    const koffi = require("koffi") as typeof import("koffi");
    const user32 = koffi.load("user32.dll");
    const kernel32 = koffi.load("kernel32.dll");

    const EnumWindows = user32.func(
      "int EnumWindows(void *lpEnumFunc, intptr_t lParam)",
    );
    const IsWindowVisible = user32.func("int IsWindowVisible(void *hWnd)");
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
    const PROCESSENTRY32 = koffi.struct("PROCESSENTRY32_SPAWN", {
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

    function pidForHwnd(hwnd: unknown): number | null {
      if (!hwnd) return null;
      const pidBuf = Buffer.alloc(4);
      GetWindowThreadProcessId(hwnd, pidBuf);
      const pid = pidBuf.readUInt32LE(0);
      return pid > 0 ? pid : null;
    }

    function hwndToNumber(hwnd: unknown): number | null {
      if (!hwnd) return null;
      const value = Number(koffi.decode(hwnd, "uintptr_t"));
      return Number.isFinite(value) && value > 0 ? value : null;
    }

    function findProcessWindowHwnds(rootPid: number): number[] {
      const hwnds: number[] = [];
      const seen = new Set<number>();

      const fgHwnd = hwndToNumber(GetForegroundWindow());
      const fgPid = fgHwnd !== null ? pidForHwnd(GetForegroundWindow()) : null;
      if (
        fgHwnd !== null &&
        fgPid !== null &&
        isDescendantOf(fgPid, rootPid) &&
        !seen.has(fgHwnd)
      ) {
        seen.add(fgHwnd);
        hwnds.push(fgHwnd);
      }

      const callback = koffi.register((hwnd: unknown) => {
        if (!IsWindowVisible(hwnd)) return true;
        const hwndNum = hwndToNumber(hwnd);
        if (hwndNum === null || seen.has(hwndNum)) return true;
        const pid = pidForHwnd(hwnd);
        if (pid === null || !isDescendantOf(pid, rootPid)) return true;
        seen.add(hwndNum);
        hwnds.push(hwndNum);
        return true;
      }, "bool __stdcall (void *hwnd, intptr_t lParam)");

      try {
        EnumWindows(callback, 0);
      } finally {
        koffi.unregister(callback);
      }

      return hwnds;
    }

    win32 = { findProcessWindowHwnds };
    return win32;
  } catch (err) {
    log("warn", `[spawn-window-match] Win32 init failed: ${String(err)}`);
    return null;
  }
}

export function matchSpawnedCaptureSource(
  sources: CaptureSource[],
  rootPid: number,
): CaptureSource | undefined {
  const w = initWin32();
  if (!w) return undefined;
  const hwnds = w.findProcessWindowHwnds(rootPid);
  if (hwnds.length === 0) return undefined;
  const match = findCaptureSourceByHwnds(sources, hwnds);
  if (match) {
    log(
      "info",
      `[spawn-window-match] Matched pid=${rootPid} hwnd=${hwnds[0]} → ${match.name}`,
    );
  }
  return match;
}
