import express, { type Express } from "express";
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
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
