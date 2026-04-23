// Windows-only keyboard/mouse input injection via the SendInput Win32 API.
// Uses koffi (https://koffi.dev/) to FFI into user32.dll without needing a
// native node addon to be compiled at install time.
//
// On non-Windows platforms (e.g. dev machines) this module degrades to a
// no-op so the agent can still be developed/tested.

import type { InputEvent } from "../shared/messages";
import { log } from "./logger";

type Injector = (event: InputEvent) => void;

let injector: Injector = () => {
  /* no-op fallback */
};

export function initInputInjector(): void {
  if (process.platform !== "win32") {
    log("info", "Input injection disabled (non-Windows platform).");
    return;
  }
  try {
    // Lazy require so non-Windows dev machines never load koffi.
    const koffi = require("koffi") as typeof import("koffi");
    const user32 = koffi.load("user32.dll");

    // INPUT struct layout (Windows): we use UNION via opaque buffer.
    // We rely on koffi to lay out the structs.
    const MOUSEINPUT = koffi.struct("MOUSEINPUT", {
      dx: "long",
      dy: "long",
      mouseData: "uint32",
      dwFlags: "uint32",
      time: "uint32",
      dwExtraInfo: "uintptr_t",
    });
    const KEYBDINPUT = koffi.struct("KEYBDINPUT", {
      wVk: "uint16",
      wScan: "uint16",
      dwFlags: "uint32",
      time: "uint32",
      dwExtraInfo: "uintptr_t",
    });
    const HARDWAREINPUT = koffi.struct("HARDWAREINPUT", {
      uMsg: "uint32",
      wParamL: "uint16",
      wParamH: "uint16",
    });
    const INPUT_UNION = koffi.union("INPUT_UNION", {
      mi: MOUSEINPUT,
      ki: KEYBDINPUT,
      hi: HARDWAREINPUT,
    });
    const INPUT = koffi.struct("INPUT", {
      type: "uint32",
      u: INPUT_UNION,
    });

    const SendInput = user32.func(
      "uint32 SendInput(uint32 cInputs, _In_ INPUT *pInputs, int cbSize)",
    );
    const GetSystemMetrics = user32.func(
      "int GetSystemMetrics(int nIndex)",
    );

    const INPUT_MOUSE = 0;
    const INPUT_KEYBOARD = 1;

    const MOUSEEVENTF_MOVE = 0x0001;
    const MOUSEEVENTF_LEFTDOWN = 0x0002;
    const MOUSEEVENTF_LEFTUP = 0x0004;
    const MOUSEEVENTF_RIGHTDOWN = 0x0008;
    const MOUSEEVENTF_RIGHTUP = 0x0010;
    const MOUSEEVENTF_MIDDLEDOWN = 0x0020;
    const MOUSEEVENTF_MIDDLEUP = 0x0040;
    const MOUSEEVENTF_WHEEL = 0x0800;
    const MOUSEEVENTF_ABSOLUTE = 0x8000;

    const KEYEVENTF_KEYUP = 0x0002;
    const KEYEVENTF_SCANCODE = 0x0008;
    const KEYEVENTF_EXTENDEDKEY = 0x0001;

    // Reserved for diagnostics; absolute mouse positioning uses the
    // [0..65535] virtual desktop coordinate space directly.
    void GetSystemMetrics;

    function sendMouse(
      flags: number,
      dx = 0,
      dy = 0,
      mouseData = 0,
    ): void {
      const input = {
        type: INPUT_MOUSE,
        u: {
          mi: {
            dx,
            dy,
            mouseData,
            dwFlags: flags,
            time: 0,
            dwExtraInfo: 0,
          },
        },
      };
      SendInput(1, [input], koffi.sizeof(INPUT));
    }

    // Per Win32 docs, KEYEVENTF_EXTENDEDKEY only applies to a specific set of
    // keys (right-side modifiers, navigation cluster, arrow keys, numpad
    // divide, numpad enter, etc.). Setting it for all keys can cause the
    // wrong scancode mapping for some layouts/games.
    const EXTENDED_VKS = new Set<number>([
      0x21, // VK_PRIOR (Page Up)
      0x22, // VK_NEXT (Page Down)
      0x23, // VK_END
      0x24, // VK_HOME
      0x25, // VK_LEFT
      0x26, // VK_UP
      0x27, // VK_RIGHT
      0x28, // VK_DOWN
      0x2c, // VK_SNAPSHOT (Print Screen)
      0x2d, // VK_INSERT
      0x2e, // VK_DELETE
      0x6f, // VK_DIVIDE (numpad /)
      0x90, // VK_NUMLOCK
      0xa3, // VK_RCONTROL
      0xa5, // VK_RMENU (right Alt)
    ]);

    function sendKey(vk: number, up: boolean): void {
      const flags =
        (up ? KEYEVENTF_KEYUP : 0) |
        (EXTENDED_VKS.has(vk) ? KEYEVENTF_EXTENDEDKEY : 0);
      const input = {
        type: INPUT_KEYBOARD,
        u: {
          ki: {
            wVk: vk,
            wScan: 0,
            dwFlags: flags,
            time: 0,
            dwExtraInfo: 0,
          },
        },
      };
      SendInput(1, [input], koffi.sizeof(INPUT));
    }

    injector = (event: InputEvent): void => {
      try {
        if (event.kind === "mousemove") {
          // Contract: the player sends normalized [0..1] coordinates relative
          // to the streamed video area. Windows SendInput with
          // MOUSEEVENTF_ABSOLUTE expects [0..65535] over the primary screen
          // (or virtual desktop with MOUSEEVENTF_VIRTUALDESK), so we scale
          // directly without dividing by screen size.
          const nx = Math.max(0, Math.min(1, event.x));
          const ny = Math.max(0, Math.min(1, event.y));
          const dx = Math.round(nx * 65535);
          const dy = Math.round(ny * 65535);
          sendMouse(MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE, dx, dy);
        } else if (event.kind === "mousedown" || event.kind === "mouseup") {
          const down = event.kind === "mousedown";
          const flag =
            event.button === "left"
              ? down
                ? MOUSEEVENTF_LEFTDOWN
                : MOUSEEVENTF_LEFTUP
              : event.button === "right"
                ? down
                  ? MOUSEEVENTF_RIGHTDOWN
                  : MOUSEEVENTF_RIGHTUP
                : down
                  ? MOUSEEVENTF_MIDDLEDOWN
                  : MOUSEEVENTF_MIDDLEUP;
          sendMouse(flag);
        } else if (event.kind === "wheel") {
          // 120 == one notch; clamp deltaY to a sane range.
          const wheel = Math.max(-1200, Math.min(1200, -event.deltaY));
          sendMouse(MOUSEEVENTF_WHEEL, 0, 0, wheel);
        } else if (event.kind === "keydown" || event.kind === "keyup") {
          const vk = mapKeyToVk(event.code, event.key);
          if (vk > 0) sendKey(vk, event.kind === "keyup");
        }
      } catch (err) {
        log("error", `Input injection failed: ${String(err)}`);
      }
    };
    log("info", "Input injector ready.");
  } catch (err) {
    log("error", `Failed to initialize input injector: ${String(err)}`);
  }
}

export function injectInput(event: InputEvent): void {
  injector(event);
}

// Minimal subset mapping from KeyboardEvent.code/key to Windows VK codes.
// Real-world deployment would use a comprehensive table or a scancode-based
// path with KEYEVENTF_SCANCODE for non-US layouts.
function mapKeyToVk(code: string, key: string): number {
  if (/^Key[A-Z]$/.test(code)) return code.charCodeAt(3); // KeyA -> 0x41
  if (/^Digit[0-9]$/.test(code)) return code.charCodeAt(5); // Digit0 -> 0x30
  const table: Record<string, number> = {
    Escape: 0x1b,
    Enter: 0x0d,
    Tab: 0x09,
    Backspace: 0x08,
    Space: 0x20,
    ArrowUp: 0x26,
    ArrowDown: 0x28,
    ArrowLeft: 0x25,
    ArrowRight: 0x27,
    ShiftLeft: 0xa0,
    ShiftRight: 0xa1,
    ControlLeft: 0xa2,
    ControlRight: 0xa3,
    AltLeft: 0xa4,
    AltRight: 0xa5,
    F1: 0x70,
    F2: 0x71,
    F3: 0x72,
    F4: 0x73,
    F5: 0x74,
    F6: 0x75,
    F7: 0x76,
    F8: 0x77,
    F9: 0x78,
    F10: 0x79,
    F11: 0x7a,
    F12: 0x7b,
  };
  if (table[code]) return table[code];
  if (key.length === 1) {
    const c = key.toUpperCase().charCodeAt(0);
    if (c >= 0x20 && c <= 0x7e) return c;
  }
  return 0;
}
