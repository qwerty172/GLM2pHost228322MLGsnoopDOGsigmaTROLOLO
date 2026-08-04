// HWND lookup for spawned game processes — used for capture source matching (HOSTING H-08).
// After native launch the renderer asks for HWNDs belonging to the game PID tree.

import { log } from "./logger";

type Win32SpawnHwnd = {
  getForegroundHwnd: () => number | null;
  hwndBelongsToPidTree: (hwnd: number, rootPid: number) => boolean;
  enumVisibleHwndsForPidTree: (rootPid: number) => number[];
};

let win32: Win32SpawnHwnd | null = null;

function initWin32(): Win32SpawnHwnd | null {
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
    const EnumWindows = user32.func("bool EnumWindows(void *lpfn, intptr_t lParam)");
    const IsWindowVisible = user32.func("bool IsWindowVisible(void *hWnd)");
    const CreateToolhelp32Snapshot = kernel32.func(
      "void *CreateToolhelp32Snapshot(uint32 dwFlags, uint32 th32ProcessID)",
    );
    const Process32First = kernel32.func("int Process32First(void *hSnapshot, void *lppe)");
    const Process32Next = kernel32.func("int Process32Next(void *hSnapshot, void *lppe)");
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

    function hwndToNumber(hwnd: unknown): number | null {
      if (!hwnd) return null;
      const n = Number(hwnd);
      return Number.isFinite(n) && n > 0 ? n : null;
    }

    function pidForHwnd(hwnd: number): number | null {
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

    function hwndBelongsToPidTree(hwnd: number, rootPid: number): boolean {
      const pid = pidForHwnd(hwnd);
      return pid !== null && isDescendantOf(pid, rootPid);
    }

    const enumCallback = koffi.proto("bool __stdcall EnumWindowsProc(void *hWnd, intptr_t lParam)");
    const collected: number[] = [];
    let enumRootPid = 0;

    const enumProc = koffi.register((hwnd: unknown) => {
      const n = hwndToNumber(hwnd);
      if (!n || !IsWindowVisible(hwnd)) return true;
      if (!hwndBelongsToPidTree(n, enumRootPid)) return true;
      collected.push(n);
      return true;
    }, enumCallback);

    function enumVisibleHwndsForPidTree(rootPid: number): number[] {
      enumRootPid = rootPid;
      collected.length = 0;
      EnumWindows(enumProc, 0);
      return [...collected];
    }

    win32 = {
      getForegroundHwnd: () => hwndToNumber(GetForegroundWindow()),
      hwndBelongsToPidTree,
      enumVisibleHwndsForPidTree,
    };
    return win32;
  } catch (err) {
    log("warn", `Spawn HWND Win32 init failed: ${String(err)}`);
    return null;
  }
}

/** HWNDs to try for desktopCapturer match — foreground first, then other visible windows. */
export function getSpawnMatchHwnds(rootPid: number): number[] {
  if (!Number.isFinite(rootPid) || rootPid <= 0) return [];
  const w = initWin32();
  if (!w) return [];

  const ordered: number[] = [];
  const fg = w.getForegroundHwnd();
  if (fg !== null && w.hwndBelongsToPidTree(fg, rootPid)) {
    ordered.push(fg);
  }
  for (const hwnd of w.enumVisibleHwndsForPidTree(rootPid)) {
    if (!ordered.includes(hwnd)) ordered.push(hwnd);
  }
  return ordered;
}
