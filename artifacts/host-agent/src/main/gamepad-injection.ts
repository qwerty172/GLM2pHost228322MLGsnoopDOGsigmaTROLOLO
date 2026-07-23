// Windows-only virtual Xbox 360 gamepad via ViGEmClient.dll (ViGEmBus driver).
// Uses koffi FFI — same pattern as input-injection.ts / SendInput.

import path from "node:path";
import { existsSync } from "node:fs";
import type { GamepadState } from "../shared/messages";
import { log } from "./logger";

export interface GamepadInjectorStatus {
  ok: boolean;
  error: string;
  platform: string;
  /** True when ViGEmBus driver is connected and a virtual pad exists. */
  connected: boolean;
}

let status: GamepadInjectorStatus = {
  ok: true,
  error: "",
  platform: process.platform,
  connected: false,
};

type GamepadBackend = {
  connect: () => boolean;
  disconnect: () => void;
  update: (state: GamepadState) => void;
};

let backend: GamepadBackend | null = null;
let noopBackend: GamepadBackend = {
  connect: () => false,
  disconnect: () => {},
  update: () => {},
};

export function getGamepadInjectorStatus(): GamepadInjectorStatus {
  return { ...status };
}

function resolveViGEmDllPath(): string | null {
  const candidates = [
    path.join(process.resourcesPath ?? "", "ViGEmClient.dll"),
    path.join(__dirname, "..", "..", "native", "ViGEmClient.dll"),
    "ViGEmClient.dll",
    path.join(
      process.env["ProgramFiles"] ?? "C:\\Program Files",
      "Nefarius Software Solutions",
      "ViGEm Bus Driver",
      "ViGEmClient.dll",
    ),
  ];
  for (const p of candidates) {
    if (p === "ViGEmClient.dll" || existsSync(p)) return p;
  }
  return null;
}

// XUSB_GAMEPAD_* button flags (Win32 XInput layout).
const BTN_FLAGS = [
  0x1000, // A
  0x2000, // B
  0x4000, // X
  0x8000, // Y
  0x0100, // LB
  0x0200, // RB
  0, // LT — analog trigger
  0, // RT — analog trigger
  0x0020, // Back / Select
  0x0010, // Start
] as const;

function axisToShort(v: number): number {
  const clamped = Math.max(-1, Math.min(1, v));
  return Math.round(clamped * 32767);
}

function stateToReport(state: GamepadState) {
  let wButtons = 0;
  for (let i = 0; i < Math.min(state.buttons.length, BTN_FLAGS.length); i++) {
    if (state.buttons[i] && BTN_FLAGS[i]) wButtons |= BTN_FLAGS[i]!;
  }
  return {
    wButtons,
    bLeftTrigger: state.buttons[6] ? 255 : 0,
    bRightTrigger: state.buttons[7] ? 255 : 0,
    sThumbLX: axisToShort(state.axes[0] ?? 0),
    sThumbLY: axisToShort(-(state.axes[1] ?? 0)),
    sThumbRX: axisToShort(state.axes[2] ?? 0),
    sThumbRY: axisToShort(-(state.axes[3] ?? 0)),
  };
}

export function initGamepadInjector(): void {
  if (process.platform !== "win32") {
    log("info", "Gamepad injection disabled (non-Windows platform).");
    backend = noopBackend;
    return;
  }

  const dllPath = resolveViGEmDllPath();
  if (!dllPath) {
    status = {
      ok: false,
      error:
        "ViGEmClient.dll не найден. Установи драйвер ViGEmBus: " +
        "https://github.com/ViGEm/ViGEmBus/releases — " +
        "без него тач-геймпад с телефона не будет работать.",
      platform: process.platform,
      connected: false,
    };
    backend = noopBackend;
    return;
  }

  try {
    const koffi = require("koffi") as typeof import("koffi");
    const vigem = koffi.load(dllPath);

    const XUSB_REPORT = koffi.struct("XUSB_REPORT", {
      wButtons: "uint16",
      bLeftTrigger: "uint8",
      bRightTrigger: "uint8",
      sThumbLX: "int16",
      sThumbLY: "int16",
      sThumbRX: "int16",
      sThumbRY: "int16",
    });

    const vigem_alloc = vigem.func("void *vigem_alloc()");
    const vigem_free = vigem.func("void vigem_free(void *client)");
    const vigem_connect = vigem.func("int32 vigem_connect(void *client)");
    const vigem_disconnect = vigem.func("void vigem_disconnect(void *client)");
    const vigem_target_x360_alloc = vigem.func(
      "void *vigem_target_x360_alloc()",
    );
    const vigem_target_free = vigem.func("void vigem_target_free(void *target)");
    const vigem_target_add = vigem.func(
      "int32 vigem_target_add(void *client, void *target)",
    );
    const vigem_target_remove = vigem.func(
      "int32 vigem_target_remove(void *client, void *target)",
    );
    const vigem_target_x360_update = vigem.func(
      "int32 vigem_target_x360_update(void *client, void *target, XUSB_REPORT report)",
    );

    let client: unknown = null;
    let target: unknown = null;
    let isConnected = false;

    backend = {
      connect(): boolean {
        if (isConnected) return true;
        try {
          client = vigem_alloc();
          if (!client) throw new Error("vigem_alloc returned null");
          const conn = vigem_connect(client);
          if (conn !== 0) {
            throw new Error(`vigem_connect failed (${conn}) — ViGEmBus не установлен?`);
          }
          target = vigem_target_x360_alloc();
          if (!target) throw new Error("vigem_target_x360_alloc returned null");
          const add = vigem_target_add(client, target);
          if (add !== 0) throw new Error(`vigem_target_add failed (${add})`);
          isConnected = true;
          status = { ...status, ok: true, error: "", connected: true };
          log("info", "Virtual Xbox 360 gamepad connected (ViGEm).");
          return true;
        } catch (err) {
          log("error", `Gamepad connect failed: ${String(err)}`);
          status = {
            ok: false,
            error:
              "ViGEmBus не установлен или недоступен. " +
              "Скачай и установи драйвер: https://github.com/ViGEm/ViGEmBus/releases",
            platform: process.platform,
            connected: false,
          };
          backend?.disconnect();
          return false;
        }
      },
      disconnect(): void {
        if (!client) return;
        try {
          if (target && isConnected) {
            vigem_target_remove(client, target);
          }
        } catch { /* ignore */ }
        try {
          if (target) vigem_target_free(target);
        } catch { /* ignore */ }
        try {
          vigem_disconnect(client);
        } catch { /* ignore */ }
        try {
          vigem_free(client);
        } catch { /* ignore */ }
        client = null;
        target = null;
        isConnected = false;
        status = { ...status, connected: false };
      },
      update(state: GamepadState): void {
        if (!isConnected || !client || !target) return;
        try {
          const report = stateToReport(state);
          vigem_target_x360_update(client, target, report);
        } catch (err) {
          log("error", `Gamepad update failed: ${String(err)}`);
        }
      },
    };

    log("info", "Gamepad injector ready (ViGEmClient loaded).");
  } catch (err) {
    log("error", `Failed to initialize gamepad injector: ${String(err)}`);
    status = {
      ok: false,
      error:
        "Не удалось загрузить ViGEmClient.dll — тач-геймпад недоступен. " +
        `Техническая ошибка: ${String(err)}`,
      platform: process.platform,
      connected: false,
    };
    backend = noopBackend;
  }
}

export function connectGamepad(): boolean {
  if (!backend) initGamepadInjector();
  return backend?.connect() ?? false;
}

export function disconnectGamepad(): void {
  backend?.disconnect();
}

export function injectGamepad(state: GamepadState): void {
  if (!backend) initGamepadInjector();
  if (!status.connected) {
    connectGamepad();
  }
  backend?.update(state);
}

export function destroyGamepadInjector(): void {
  disconnectGamepad();
}
