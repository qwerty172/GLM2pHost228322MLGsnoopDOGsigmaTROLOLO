# Cloud Gaming Host Agent (Windows)

Native Windows agent that turns a host PC into a streamable cloud-gaming
endpoint. The agent runs in the system tray, captures the configured game
window, streams it to a remote player over WebRTC, and injects the player's
keyboard and mouse input via the Win32 `SendInput` API.

## Architecture

```
┌────────────────────────────────────────────────────────┐
│  Electron main process (Node)                          │
│   ├─ tray icon + status (idle / connecting / streaming)│
│   ├─ config persistence (userData/config.json)         │
│   ├─ child-process app launcher                        │
│   └─ koffi → user32!SendInput                          │
└────────────────────────┬───────────────────────────────┘
                         │ ipc (contextBridge)
┌────────────────────────▼───────────────────────────────┐
│  Renderer (Chromium)                                   │
│   ├─ settings UI                                       │
│   ├─ POST /api/sessions → playerToken share link       │
│   ├─ WS /api/signal?role=host                          │
│   ├─ desktopCapturer → MediaStream                     │
│   └─ RTCPeerConnection (offer/answer/ICE) + DataChannel│
└────────────────────────────────────────────────────────┘
```

## First launch

1. Get your **host token** from the platform's web dashboard.
2. Open the agent — it lives in the tray; double-click to open settings.
3. Fill in:
   - **Host token** — from the dashboard.
   - **Platform URL** — e.g. `https://gaming.example.com`. The signaling URL
     is derived as `wss://<host>/api/signal` automatically (override possible).
   - **Game / app path** — full path to the `.exe` to launch.
   - **Rate per minute** — what the player pays per minute (USD).
4. Click **Go online & create session** — the agent creates a session with the
   API and shows a player share link. Send it to the player.
5. When the player connects, the configured `.exe` is launched, screen capture
   begins, and a WebRTC peer connection is established.

The agent registers itself for auto-launch at Windows login (configurable).

## Build & run (dev)

```sh
pnpm --filter @workspace/host-agent install
pnpm --filter @workspace/host-agent run start
```

## Package the Windows installer

Must be run on a Windows host (or a Wine-based CI):

```sh
pnpm --filter @workspace/host-agent run package:win
```

Output: `artifacts/host-agent/release/Cloud Gaming Host Agent-Setup-X.Y.Z.exe`
(NSIS installer, x64).

## Files

- `src/main/` — Electron main process (tray, config, app launcher, input
  injection, IPC handlers).
- `src/preload/index.ts` — `contextBridge` API exposed to the renderer.
- `src/renderer/` — settings UI + signaling/WebRTC client.
- `src/shared/messages.ts` — IPC + config types shared between processes.
- `electron-builder.yml` + `build/installer.nsh` — Windows packaging config.

## Notes / limitations

- v1 is Windows-only. Non-Windows platforms can build and run the UI for
  development but input injection is a no-op.
- Software encode only; GPU encoders are out of scope for v1.
- One player per host instance. Multiplexing is out of scope for v1.
- The keyboard mapping table covers the common subset (letters, digits,
  arrows, F-keys, modifiers). Non-US layouts and dead keys may need a
  scancode-based path.
