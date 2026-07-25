import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { resolveOwnerByToken } from "../lib/walletOwner";
import { logger } from "../lib/logger";
import { rateLimit, ipKey } from "../lib/rateLimit";
import { hostTokenFromRequest } from "../lib/hostAuth";

const router: IRouter = Router();

const vtLookupLimiter = rateLimit({
  scope: "vt:lookup",
  windowMs: 60_000,
  max: 30,
  keyFn: ipKey,
});

const VT_BASE = "https://www.virustotal.com/api/v3";
const SHA256_RE = /^[a-fA-F0-9]{64}$/;

// In-memory cache: hash/url → {result, expiresAt}
const vtCache = new Map<string, { data: VtResult; expiresAt: number }>();
const VT_CACHE_TTL = 30 * 60_000; // 30 min

export interface VtResult {
  status: "clean" | "suspicious" | "malicious" | "unknown" | "error";
  harmless: number;
  suspicious: number;
  malicious: number;
  undetected: number;
  total: number;
  permalink: string;
  sha256?: string;
  name?: string;
  errorMessage?: string;
}

function classify(malicious: number, suspicious: number): VtResult["status"] {
  if (malicious >= 3) return "malicious";
  if (malicious >= 1 || suspicious >= 3) return "suspicious";
  return "clean";
}

async function vtGetFile(sha256: string, apiKey: string): Promise<VtResult> {
  const cached = vtCache.get(sha256);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const r = await fetch(`${VT_BASE}/files/${sha256}`, {
    headers: { "x-apikey": apiKey },
    signal: AbortSignal.timeout(10_000),
  });

  if (r.status === 404) {
    const result: VtResult = {
      status: "unknown",
      harmless: 0,
      suspicious: 0,
      malicious: 0,
      undetected: 0,
      total: 0,
      permalink: `https://www.virustotal.com/gui/file/${sha256}`,
      sha256,
      errorMessage: "Файл не найден в базе VirusTotal",
    };
    vtCache.set(sha256, { data: result, expiresAt: Date.now() + VT_CACHE_TTL });
    return result;
  }

  if (!r.ok) throw new Error(`VT API error ${r.status}`);

  const json = (await r.json()) as {
    data: {
      attributes: {
        last_analysis_stats: {
          harmless: number;
          suspicious: number;
          malicious: number;
          undetected: number;
        };
        sha256: string;
        meaningful_name?: string;
      };
    };
  };

  const stats = json.data.attributes.last_analysis_stats;
  const total = stats.harmless + stats.suspicious + stats.malicious + stats.undetected;
  const result: VtResult = {
    status: classify(stats.malicious, stats.suspicious),
    harmless: stats.harmless,
    suspicious: stats.suspicious,
    malicious: stats.malicious,
    undetected: stats.undetected,
    total,
    permalink: `https://www.virustotal.com/gui/file/${json.data.attributes.sha256}`,
    sha256: json.data.attributes.sha256,
    name: json.data.attributes.meaningful_name,
  };
  vtCache.set(sha256, { data: result, expiresAt: Date.now() + VT_CACHE_TTL });
  return result;
}

async function vtScanUrl(url: string, apiKey: string): Promise<VtResult> {
  const cacheKey = `url:${url}`;
  const cached = vtCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  // Step 1: submit URL for analysis
  const submitRes = await fetch(`${VT_BASE}/urls`, {
    method: "POST",
    headers: {
      "x-apikey": apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `url=${encodeURIComponent(url)}`,
    signal: AbortSignal.timeout(10_000),
  });
  if (!submitRes.ok) throw new Error(`VT submit error ${submitRes.status}`);

  const submitJson = (await submitRes.json()) as { data: { id: string } };
  const analysisId = submitJson.data.id;

  type AnalysisResponse = {
    data: {
      attributes: {
        status: string;
        stats: {
          harmless: number;
          suspicious: number;
          malicious: number;
          undetected: number;
        };
        url?: string;
      };
      links?: { self?: string };
    };
  };

  // Step 2: poll analysis result with exponential backoff (1s, 2s, 4s, 8s, 16s)
  // — avoids hammering VirusTotal and respects its rate limits.
  let analysisJson: AnalysisResponse | null = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    const pollRes = await fetch(`${VT_BASE}/analyses/${analysisId}`, {
      headers: { "x-apikey": apiKey },
      signal: AbortSignal.timeout(10_000),
    });
    // Back off (rather than fail) if VT rate-limits the poll.
    if (pollRes.status === 429) continue;
    if (!pollRes.ok) throw new Error(`VT poll error ${pollRes.status}`);
    const polled = (await pollRes.json()) as AnalysisResponse;
    if (polled.data.attributes.status === "completed") {
      analysisJson = polled;
      break;
    }
  }

  if (!analysisJson) {
    const result: VtResult = {
      status: "unknown",
      harmless: 0,
      suspicious: 0,
      malicious: 0,
      undetected: 0,
      total: 0,
      permalink: `https://www.virustotal.com/gui/url/${analysisId}`,
      errorMessage: "Анализ ещё не готов, попробуй через минуту",
    };
    return result;
  }

  const stats = analysisJson.data.attributes.stats;
  const total = stats.harmless + stats.suspicious + stats.malicious + stats.undetected;
  const result: VtResult = {
    status: classify(stats.malicious, stats.suspicious),
    harmless: stats.harmless,
    suspicious: stats.suspicious,
    malicious: stats.malicious,
    undetected: stats.undetected,
    total,
    permalink: `https://www.virustotal.com/gui/url/${analysisId}`,
  };
  vtCache.set(cacheKey, { data: result, expiresAt: Date.now() + VT_CACHE_TTL });
  return result;
}

const ScanBody = z.object({
  ownerToken: z.string().min(1),
  input: z.string().min(1).max(2000),
});

// POST /api/vt/scan
// Checks a SHA-256 hash or download URL against VirusTotal.
// Requires a valid host/player token (no unauthenticated probing).
router.post("/vt/scan", async (req, res): Promise<void> => {
  const apiKey = process.env.VIRUSTOTAL_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "VirusTotal не настроен на сервере" });
    return;
  }

  const parsed = ScanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const owner = await resolveOwnerByToken(parsed.data.ownerToken);
  if (!owner) {
    res.status(403).json({ error: "Not authenticated" });
    return;
  }

  const { input } = parsed.data;
  const isSha256 = SHA256_RE.test(input);
  const isUrl = /^https?:\/\/./.test(input);

  if (!isSha256 && !isUrl) {
    res.status(400).json({ error: "Укажи SHA-256 хеш (64 hex-символа) или https:// URL" });
    return;
  }

  try {
    const result = isSha256
      ? await vtGetFile(input.toLowerCase(), apiKey)
      : await vtScanUrl(input, apiKey);
    res.json(result);
  } catch (err) {
    logger.error({ err }, "VT scan error");
    const msg = err instanceof Error ? err.message : "Ошибка проверки";
    res.status(502).json({
      status: "error",
      harmless: 0,
      suspicious: 0,
      malicious: 0,
      undetected: 0,
      total: 0,
      permalink: "",
      errorMessage: msg,
    } satisfies VtResult);
  }
});

// GET /api/vt/lookup?sha256=<hash>
// Quick lookup of an already-known hash (cached). Requires host auth or IP rate limit.
router.get("/vt/lookup", vtLookupLimiter, async (req, res): Promise<void> => {
  const apiKey = process.env.VIRUSTOTAL_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "VirusTotal не настроен" });
    return;
  }

  // Prefer authenticated host agent; anonymous still allowed but IP-limited above.
  const hostTok = hostTokenFromRequest(req);
  if (!hostTok && process.env.NODE_ENV === "production") {
    // In production require a host token so VT quota isn't burned anonymously.
    res.status(401).json({ error: "X-Host-Token required" });
    return;
  }

  const sha256 = String(req.query.sha256 ?? "").toLowerCase();
  if (!SHA256_RE.test(sha256)) {
    res.status(400).json({ error: "Неверный sha256" });
    return;
  }

  try {
    const result = await vtGetFile(sha256, apiKey);
    res.json(result);
  } catch (err) {
    logger.error({ err }, "VT lookup error");
    res.status(502).json({ error: "VT lookup failed" });
  }
});

export default router;
