// Local HTTP server on 127.0.0.1:18080.
//
// Endpoints:
//   GET  /ping         → { status, version, audioMode }  — dashboard presence check
//   GET  /readiness    → { status, version, audioMode, inputOk } — full local probe (U-14)
//   GET  /steam-games  → { games: [...] }                — local Steam installs with exe paths
//   POST /input        → 204 | 400 | 401                 — relay InputEvent to SendInput
//   POST /pick-exe     → { path } | { path: null }        — open native file dialog (.exe)
//   OPTIONS *          → 204                             — CORS preflight
//
// POST /input and POST /pick-exe require header X-Agent-Input-Secret (see shared/input.ts).
// CORS is origin-whitelisted so random websites cannot call /input.

import http from "node:http";
import type { InputEvent } from "../shared/messages";
import {
  INPUT_SECRET_HEADER,
  LOCAL_INPUT_SECRET,
  parseInputEvent,
} from "../shared/input";

export { parseInputEvent, LOCAL_INPUT_SECRET, INPUT_SECRET_HEADER };

export const PING_PORT = 18080;
/** Fallback ports when 18080 is already bound. */
export const PING_PORT_FALLBACKS = [18081, 18082, 18083];

/** Minimal Steam game info exposed to the web dashboard for exe path picking. */
export type AgentSteamGameInfo = {
  appId: string;
  name: string;
  bestExePath: string | null;
};

export interface PingServerDeps {
  // Returns presence info for GET /ping. Must never throw.
  getInfo: () => Promise<{ version: string; audioMode: string; port?: number }>;
  // Relays a validated InputEvent to the OS-level injector.
  injectInput: (event: InputEvent) => void;
  log: (level: "info" | "warn" | "error", message: string) => void;
  // Shared secret for POST /input. Defaults to LOCAL_INPUT_SECRET.
  getInputSecret?: () => string;
  // Extra allowed CORS origins (e.g. configured apiBaseUrl origin).
  getAllowedOrigins?: () => string[];
  // Opens a native .exe file picker (Windows). Used by POST /pick-exe.
  pickExe?: () => Promise<string | null>;
  // Returns locally installed Steam games. Used by GET /steam-games.
  getSteamGames?: () => Promise<AgentSteamGameInfo[]>;
}

const DEFAULT_ALLOWED_ORIGIN_PREFIXES = [
  "http://localhost",
  "http://127.0.0.1",
  "https://localhost",
  "https://127.0.0.1",
];

function isOriginAllowed(origin: string | undefined, extra: string[]): boolean {
  if (!origin) return true; // non-browser / same-origin tools
  for (const prefix of DEFAULT_ALLOWED_ORIGIN_PREFIXES) {
    if (origin === prefix || origin.startsWith(prefix + ":")) return true;
  }
  for (const allowed of extra) {
    if (!allowed) continue;
    if (origin === allowed || origin.startsWith(allowed + "/")) return true;
  }
  return false;
}

function applyCors(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  extraOrigins: string[],
): boolean {
  const origin = req.headers.origin;
  if (typeof origin === "string" && isOriginAllowed(origin, extraOrigins)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      `Content-Type, ${INPUT_SECRET_HEADER}`,
    );
    return true;
  }
  if (!origin) {
    // No Origin header — allow (curl / same-machine tools).
    return true;
  }
  return false;
}

function readInputSecret(
  req: http.IncomingMessage,
  getInputSecret: (() => string) | undefined,
): string | null {
  const expected = getInputSecret?.() ?? LOCAL_INPUT_SECRET;
  const provided = req.headers[INPUT_SECRET_HEADER];
  const headerVal = Array.isArray(provided) ? provided[0] : provided;
  if (!headerVal || headerVal !== expected) return null;
  return expected;
}

export function createPingServer(deps: PingServerDeps): http.Server {
  return http.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    const extraOrigins = deps.getAllowedOrigins?.() ?? [];
    const corsOk = applyCors(req, res, extraOrigins);

    if (req.method === "OPTIONS") {
      if (!corsOk) {
        res.writeHead(403);
        res.end(JSON.stringify({ error: "origin_not_allowed" }));
        return;
      }
      res.writeHead(204);
      res.end();
      return;
    }

    // POST /pick-exe — opens native file dialog; used by host library web UI.
    if (req.method === "POST" && req.url === "/pick-exe") {
      if (!corsOk) {
        res.writeHead(403);
        res.end(JSON.stringify({ error: "origin_not_allowed" }));
        return;
      }
      if (!readInputSecret(req, deps.getInputSecret)) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: "unauthorized" }));
        return;
      }
      if (!deps.pickExe) {
        res.writeHead(503);
        res.end(JSON.stringify({ error: "pick_exe_unavailable" }));
        return;
      }
      void deps
        .pickExe()
        .then((picked) => {
          res.writeHead(200);
          res.end(JSON.stringify({ path: picked }));
        })
        .catch((err) => {
          deps.log("error", `POST /pick-exe failed: ${String(err)}`);
          res.writeHead(500);
          res.end(JSON.stringify({ error: "pick_exe_failed" }));
        });
      return;
    }

    // POST /input — requires shared secret; used by browser-play.tsx.
    if (req.method === "POST" && req.url === "/input") {
      if (!corsOk) {
        res.writeHead(403);
        res.end(JSON.stringify({ error: "origin_not_allowed" }));
        return;
      }
      if (!readInputSecret(req, deps.getInputSecret)) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: "unauthorized" }));
        return;
      }

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

    if (req.method !== "GET") {
      res.writeHead(405);
      res.end(JSON.stringify({ error: "method_not_allowed" }));
      return;
    }

    // GET handlers — presence only (no secret in response).
    if (!corsOk) {
      res.writeHead(403);
      res.end(JSON.stringify({ error: "origin_not_allowed" }));
      return;
    }

    if (req.url === "/steam-games") {
      if (!deps.getSteamGames) {
        res.writeHead(503);
        res.end(JSON.stringify({ error: "steam_games_unavailable" }));
        return;
      }
      void deps
        .getSteamGames()
        .then((games) => {
          res.writeHead(200);
          res.end(JSON.stringify({ games }));
        })
        .catch((err) => {
          deps.log("error", `GET /steam-games failed: ${String(err)}`);
          res.writeHead(500);
          res.end(JSON.stringify({ error: "steam_games_failed" }));
        });
      return;
    }

    const isPing = req.url === "/ping";
    const isReadiness = req.url === "/readiness";
    if (!isPing && !isReadiness) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: "not_found" }));
      return;
    }

    void deps
      .getInfo()
      .catch(async () => {
        try {
          const { getAgentVersion } = await import("./agent-version.js");
          return { version: getAgentVersion(), audioMode: "off" };
        } catch {
          return { version: "unknown", audioMode: "off" };
        }
      })
      .then((info) => {
        let inputOk = true;
        if (isReadiness) {
          try {
            deps.injectInput({ kind: "mousemove", x: 0, y: 0 });
          } catch {
            inputOk = false;
          }
        }
        res.writeHead(200);
        res.end(
          JSON.stringify(
            isReadiness ? { status: "ok", ...info, inputOk } : { status: "ok", ...info },
          ),
        );
      });
  });
}
