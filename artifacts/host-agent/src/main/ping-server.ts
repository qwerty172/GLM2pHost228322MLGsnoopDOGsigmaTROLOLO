// Local HTTP server on 127.0.0.1:18080.
//
// Endpoints:
//   GET  /ping   → { status, version, audioMode }  — dashboard presence check
//   POST /input  → 204 | 400                       — relay InputEvent to SendInput
//   OPTIONS *    → 204                             — CORS preflight
//
// Extracted from index.ts so it can be unit-tested outside Electron: all
// Electron-touching dependencies (config, logging, injection) are passed in.

import http from "node:http";
import type { InputEvent } from "../shared/messages";

export const PING_PORT = 18080;

const VALID_INPUT_KINDS = new Set([
  "mousemove",
  "mousedown",
  "mouseup",
  "wheel",
  "keydown",
  "keyup",
]);

export interface PingServerDeps {
  // Returns presence info for GET /ping. Must never throw.
  getInfo: () => Promise<{ version: string; audioMode: string }>;
  // Relays a validated InputEvent to the OS-level injector.
  injectInput: (event: InputEvent) => void;
  log: (level: "info" | "warn" | "error", message: string) => void;
}

// Validate an unknown JSON payload as an InputEvent. Returns the event or
// null when the shape is not one of the known kinds.
export function parseInputEvent(raw: unknown): InputEvent | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  const kind = obj["kind"];
  if (typeof kind !== "string" || !VALID_INPUT_KINDS.has(kind)) return null;
  if (kind === "mousemove") {
    if (typeof obj["x"] !== "number" || typeof obj["y"] !== "number") return null;
    if (!Number.isFinite(obj["x"]) || !Number.isFinite(obj["y"])) return null;
  }
  if (kind === "mousedown" || kind === "mouseup") {
    if (obj["button"] !== "left" && obj["button"] !== "right" && obj["button"] !== "middle") {
      return null;
    }
  }
  if (kind === "wheel") {
    if (typeof obj["deltaY"] !== "number" || !Number.isFinite(obj["deltaY"])) return null;
  }
  if (kind === "keydown" || kind === "keyup") {
    if (typeof obj["code"] !== "string" || typeof obj["key"] !== "string") return null;
  }
  return raw as InputEvent;
}

export function createPingServer(deps: PingServerDeps): http.Server {
  return http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json");

    // CORS preflight — browsers send this before cross-origin POST.
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.writeHead(204);
      res.end();
      return;
    }

    // POST /input — relay a single InputEvent to Win32 SendInput.
    // Used by browser-play.tsx when streaming an external URL: player input
    // arrives via WebRTC DataChannel; the host page forwards it here so the
    // agent can inject it at the OS level.
    if (req.method === "POST" && req.url === "/input") {
      let body = "";
      let overflow = false;
      req.on("data", (chunk: Buffer) => {
        body += chunk.toString();
        if (body.length > 64 * 1024) {
          overflow = true;
          req.destroy();
        }
      });
      req.on("end", () => {
        if (overflow) return;
        let raw: unknown;
        try {
          raw = JSON.parse(body);
        } catch {
          res.writeHead(400);
          res.end(JSON.stringify({ error: "bad_input" }));
          return;
        }
        const event = parseInputEvent(raw);
        if (!event) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: "bad_input" }));
          return;
        }
        try {
          deps.injectInput(event);
          res.writeHead(204);
          res.end();
        } catch (err) {
          deps.log("error", `POST /input injection failed: ${String(err)}`);
          res.writeHead(500);
          res.end(JSON.stringify({ error: "inject_failed" }));
        }
      });
      return;
    }

    if (req.method === "POST") {
      res.writeHead(404);
      res.end(JSON.stringify({ error: "not_found" }));
      return;
    }

    // GET /ping (and any other GET) — presence + version info.
    void deps
      .getInfo()
      .catch(() => ({ version: "0.1.0", audioMode: "off" }))
      .then((info) => {
        res.writeHead(200);
        res.end(JSON.stringify({ status: "ok", ...info }));
      });
  });
}
