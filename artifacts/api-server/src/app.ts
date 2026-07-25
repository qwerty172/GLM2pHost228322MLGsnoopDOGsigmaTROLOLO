import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { headerUserToken, TOKEN_PLACEHOLDER } from "./lib/requestToken";

const app: Express = express();

// The API runs behind the Replit proxy — trust X-Forwarded-For so req.ip
// reflects the real client for per-IP rate limiting.
app.set("trust proxy", true);

// X-User-Token header support: clients that send the token in the header use
// the literal `@me` placeholder in token path segments (e.g. /api/wallet/@me).
// Substitute the real token back into the URL before routing so existing
// param-based handlers work unchanged. `@me` never collides with real routes
// (the literal /hosts/me/* routes use "me", not "@me").
app.use((req, _res, next) => {
  const token = headerUserToken(req);
  if (token && req.url.includes(`/${TOKEN_PLACEHOLDER}`)) {
    const seg = `/${TOKEN_PLACEHOLDER}`;
    const idx = req.url.indexOf(seg);
    const after = req.url[idx + seg.length];
    if (after === undefined || after === "/" || after === "?") {
      // Keep the token-free URL around for request logging — the rewritten
      // req.url contains the secret and must never reach the logs.
      (req as { logSafeUrl?: string }).logSafeUrl = req.url;
      req.url =
        req.url.slice(0, idx) +
        `/${encodeURIComponent(token)}` +
        req.url.slice(idx + seg.length);
    }
  }
  next();
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        // Prefer the pre-substitution URL (`/…/@me/…`) captured by the
        // X-User-Token middleware so header tokens never appear in logs.
        const raw = req.raw as { logSafeUrl?: string } | undefined;
        return {
          id: req.id,
          method: req.method,
          url: (raw?.logSafeUrl ?? req.url)?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
function parseOriginList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Allowed browser origins: CORS_ORIGINS env + optional embed allowlist. */
function buildAllowedOrigins(): Set<string> {
  const origins = new Set<string>([
    ...parseOriginList(process.env.CORS_ORIGINS),
    ...parseOriginList(process.env.EMBED_ALLOWED_ORIGINS),
  ]);
  // Common local / Replit defaults when env is unset (dev convenience).
  if (origins.size === 0 && process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:5173");
    origins.add("http://127.0.0.1:5173");
    origins.add("http://localhost:5000");
    origins.add("http://127.0.0.1:5000");
  }
  const appUrl = process.env.APP_URL ?? process.env.PUBLIC_WEB_URL;
  if (appUrl) {
    try {
      origins.add(new URL(appUrl).origin);
    } catch {
      /* ignore invalid */
    }
  }
  // Auto-allow all Replit-assigned domains (REPLIT_DOMAINS covers both the
  // dev *.replit.dev preview and the prod *.replit.app deployment domain).
  for (const d of parseOriginList(process.env.REPLIT_DOMAINS)) {
    origins.add(`https://${d}`);
    origins.add(`http://${d}`);
  }
  return origins;
}

/** True for any *.replit.dev or *.replit.app origin — catches domains that
 *  weren't listed in REPLIT_DOMAINS at startup (e.g. custom subdomains). */
function isReplitOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname.endsWith(".replit.dev") || hostname.endsWith(".replit.app");
  } catch {
    return false;
  }
}

const allowedOrigins = buildAllowedOrigins();

app.use(
  cors({
    origin(origin, callback) {
      // Non-browser clients (curl, host-agent, server-to-server) send no Origin.
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.has(origin) || isReplitOrigin(origin)) {
        callback(null, true);
        return;
      }
      // In production with an empty whitelist, fail closed for browser Origins.
      if (process.env.NODE_ENV === "production" && allowedOrigins.size === 0) {
        callback(new Error(`CORS origin not allowed: ${origin}`));
        return;
      }
      if (allowedOrigins.size === 0) {
        // Dev with no configured list: allow (dev defaults already seeded above).
        callback(null, true);
        return;
      }
      callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// 404 — no route matched
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: "not_found",
    message: `No route for ${req.method} ${req.path}`,
  });
});

// Global error handler — Express 5 forwards rejected promises here.
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const status =
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    typeof (err as { status: unknown }).status === "number"
      ? (err as { status: number }).status
      : typeof err === "object" &&
          err !== null &&
          "statusCode" in err &&
          typeof (err as { statusCode: unknown }).statusCode === "number"
        ? (err as { statusCode: number }).statusCode
        : 500;

  // CORS errors from the cors package
  const message =
    err instanceof Error ? err.message : "Internal server error";
  if (message.startsWith("CORS origin not allowed")) {
    res.status(403).json({ error: "cors_forbidden", message });
    return;
  }

  req.log?.error({ err }, "Unhandled request error");
  if (res.headersSent) return;
  res.status(status >= 400 && status < 600 ? status : 500).json({
    error: status === 500 ? "internal_error" : "request_error",
    message: status === 500 ? "Internal server error" : message,
  });
});

export default app;
