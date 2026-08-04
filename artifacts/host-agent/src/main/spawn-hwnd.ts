// HWND resolution for spawned native games (HOSTING H-08).
// Cross-references desktopCapturer source ids with Win32 process ownership.

import { desktopCapturer } from "electron";
import { parseHwndFromSourceId } from "../shared/window-match";
import { isPidInProcessTree } from "./focus-guard";
import { log } from "./logger";

type Win32Pid = {
  getPidForHwnd: (hwnd: number) => number | null;
  getForegroundHwnd: () => number | null;
};

let win32: Win32Pid | null = null;
let win32InitFailed = false;

function initWin32(): Win32Pid | null {
  if (process.platform !== "win32") return null;
  if (win32) return win32;
  if (win32InitFailed) return null;
  try {
    const koffi = require("koffi") as typeof import("koffi");
    const user32 = koffi.load("user32.dll");

    const GetForegroundWindow = user32.func("void *GetForegroundWindow()");
    const GetWindowThreadProcessId = user32.func(
      "uint32 GetWindowThreadProcessId(void *hWnd, uint32 *lpdwProcessId)",
    );

    function hwndFromPtr(ptr: unknown): number {
      if (typeof ptr === "number") return ptr;
      if (typeof ptr === "bigint") return Number(ptr);
      return Number(koffi.decode(ptr, "uintptr_t"));
    }

    function getPidForHwnd(hwnd: number): number | null {
      if (hwnd <= 0) return null;
      const pidBuf = Buffer.alloc(4);
      GetWindowThreadProcessId(hwnd, pidBuf);
      const pid = pidBuf.readUInt32LE(0);
      return pid > 0 ? pid : null;
    }

    function getForegroundHwnd(): number | null {
      const ptr = GetForegroundWindow();
      if (!ptr) return null;
      const hwnd = hwndFromPtr(ptr);
      return hwnd > 0 ? hwnd : null;
    }

    win32 = { getPidForHwnd, getForegroundHwnd };
    return win32;
  } catch (err) {
    win32InitFailed = true;
    log("warn", `[spawn-hwnd] Win32 init failed: ${String(err)}`);
    return null;
  }
}

/** Visible capture HWNDs owned by the spawned game PID; foreground first when applicable. */
export async function getHwndsForSpawnedPid(pid: number): Promise<number[]> {
  if (pid <= 0) return [];
  const w = initWin32();
  if (!w) return [];

  try {
    const sources = await desktopCapturer.getSources({
      types: ["window"],
      thumbnailSize: { width: 0, height: 0 },
    });

    const matched: number[] = [];
    for (const s of sources) {
      const hwnd = parseHwndFromSourceId(s.id);
      if (hwnd === null) continue;
      const hwndPid = w.getPidForHwnd(hwnd);
      if (hwndPid !== null && isPidInProcessTree(hwndPid, pid)) matched.push(hwnd);
    }

    const fg = w.getForegroundHwnd();
    const fgPid = fg !== null ? w.getPidForHwnd(fg) : null;
    if (fg !== null && fgPid !== null && isPidInProcessTree(fgPid, pid)) {
      const rest = matched.filter((h) => h !== fg);
      return [fg, ...rest];
    }

    return matched;
  } catch (err) {
    log("warn", `[spawn-hwnd] getHwnds failed pid=${pid}: ${String(err)}`);
    return [];
  }
}
