import { useState } from "react";
import { Shield, ShieldAlert, ShieldCheck, ShieldX, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface VtResult {
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

interface VtScannerProps {
  ownerToken: string;
  label?: string;
}

const STATUS_CONFIG = {
  clean: {
    icon: ShieldCheck,
    color: "#22c55e",
    bg: "rgba(34,197,94,0.08)",
    border: "rgba(34,197,94,0.25)",
    label: "Чисто",
  },
  suspicious: {
    icon: ShieldAlert,
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.25)",
    label: "Подозрительно",
  },
  malicious: {
    icon: ShieldX,
    color: "#ef4444",
    bg: "rgba(239,68,68,0.08)",
    border: "rgba(239,68,68,0.25)",
    label: "Угроза обнаружена",
  },
  unknown: {
    icon: Shield,
    color: "#94a3b8",
    bg: "rgba(148,163,184,0.08)",
    border: "rgba(148,163,184,0.2)",
    label: "Нет в базе VT",
  },
  error: {
    icon: Shield,
    color: "#94a3b8",
    bg: "rgba(148,163,184,0.08)",
    border: "rgba(148,163,184,0.2)",
    label: "Ошибка",
  },
} as const;

export function VtScanner({ ownerToken, label = "Проверить файл игры" }: VtScannerProps) {
  const [input, setInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<VtResult | null>(null);

  const isValid = /^[a-fA-F0-9]{64}$/.test(input.trim()) || /^https?:\/\/./.test(input.trim());

  const scan = async () => {
    if (!isValid || !ownerToken || scanning) return;
    setScanning(true);
    setResult(null);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/vt/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerToken, input: input.trim() }),
      });
      const data = (await res.json()) as VtResult;
      setResult(data);
    } catch {
      setResult({
        status: "error",
        harmless: 0,
        suspicious: 0,
        malicious: 0,
        undetected: 0,
        total: 0,
        permalink: "",
        errorMessage: "Ошибка сети",
      });
    } finally {
      setScanning(false);
    }
  };

  const cfg = result ? STATUS_CONFIG[result.status] : null;
  const Icon = cfg?.icon ?? Shield;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Label style={{ color: "#94a3b8", fontSize: 13 }}>{label}</Label>
      <div style={{ display: "flex", gap: 8 }}>
        <Input
          value={input}
          onChange={(e) => { setInput(e.target.value); setResult(null); }}
          placeholder="SHA-256 хеш или https:// ссылка на файл"
          style={{
            flex: 1,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#e2e8f0",
            fontSize: 13,
          }}
          onKeyDown={(e) => e.key === "Enter" && scan()}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!isValid || !ownerToken || scanning}
          onClick={scan}
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.10)",
            color: "#94a3b8",
            whiteSpace: "nowrap",
            minWidth: 120,
          }}
        >
          {scanning ? (
            <>
              <Loader2 size={14} style={{ marginRight: 6, animation: "spin 1s linear infinite" }} />
              Проверяю…
            </>
          ) : (
            <>
              <Shield size={14} style={{ marginRight: 6 }} />
              Проверить
            </>
          )}
        </Button>
      </div>

      <p style={{ color: "#4a5568", fontSize: 11, marginTop: -4 }}>
        Поиск по базе VirusTotal — 70+ антивирусных движков. Введи хеш из документации игры или прямую ссылку на установщик.
      </p>

      {scanning && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 14px",
          background: "rgba(148,163,184,0.06)",
          border: "1px solid rgba(148,163,184,0.15)",
          borderRadius: 8,
          color: "#64748b",
          fontSize: 13,
        }}>
          <Loader2 size={14} style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
          <span>Отправляю на проверку{/^https?:\/\//.test(input.trim()) ? " (URL-сканирование до 10 сек)" : ""}…</span>
        </div>
      )}

      {result && cfg && !scanning && (
        <div style={{
          padding: "12px 14px",
          background: cfg.bg,
          border: `1px solid ${cfg.border}`,
          borderRadius: 8,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon size={16} color={cfg.color} style={{ flexShrink: 0 }} />
            <span style={{ color: cfg.color, fontWeight: 600, fontSize: 14 }}>
              {cfg.label}
            </span>
            {result.name && (
              <span style={{ color: "#64748b", fontSize: 12, marginLeft: "auto" }}>
                {result.name}
              </span>
            )}
          </div>

          {result.total > 0 && (
            <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
              {result.malicious > 0 && (
                <span style={{ color: "#ef4444" }}>
                  ❌ {result.malicious} угроз
                </span>
              )}
              {result.suspicious > 0 && (
                <span style={{ color: "#f59e0b" }}>
                  ⚠ {result.suspicious} подозрительных
                </span>
              )}
              <span style={{ color: "#22c55e" }}>
                ✓ {result.harmless} чистых
              </span>
              <span style={{ color: "#475569" }}>
                из {result.total} движков
              </span>
            </div>
          )}

          {result.errorMessage && (
            <p style={{ color: "#64748b", fontSize: 12, margin: 0 }}>
              {result.errorMessage}
            </p>
          )}

          {result.sha256 && (
            <p style={{ color: "#334155", fontSize: 11, margin: 0, fontFamily: "monospace", wordBreak: "break-all" }}>
              {result.sha256}
            </p>
          )}

          {result.permalink && (
            <a
              href={result.permalink}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#3b82f6", fontSize: 12, display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}
            >
              Полный отчёт на VirusTotal
              <ExternalLink size={11} />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
