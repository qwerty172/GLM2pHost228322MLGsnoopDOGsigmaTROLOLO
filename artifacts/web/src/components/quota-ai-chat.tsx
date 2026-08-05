import { useState, useRef, useEffect } from "react";
import {
  useQuotaAiChat,
  type QuotaFormState as ApiQuotaFormState,
} from "@workspace/api-client-react";
import { formatApiError } from "@/lib/api-errors";
import { Send, Bot, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type QuotaFormState = {
  kind: string;
  title: string;
  description: string;
  visibility: string;
  royaltyBasis: string;
  royaltyValue: number;
  royaltySource: string;
  budgetLzt: number;
  sponsorHostPerMinute: number;
  sponsorPlayerPerMinute: number;
  gameId: string;
  minSessionMinutes: string;
  maxSessionMinutes: string;
  startAt: string;
  endAt: string;
  minGpuVram?: string;
  minCpuCores?: string;
  minRamGb?: string;
  minDownloadMbps?: string;
  minUploadMbps?: string;
  recGpuVram?: string;
  recCpuCores?: string;
  recRamGb?: string;
  recDownloadMbps?: string;
  recUploadMbps?: string;
  requiredTier?: "min" | "recommended";
};

export type QuotaFormPatch = {
  kind?: string;
  title?: string;
  description?: string;
  visibility?: string;
  royaltyBasis?: string;
  royaltyValue?: number;
  royaltySource?: string;
  budgetLzt?: number;
  sponsorHostPerMinute?: number;
  sponsorPlayerPerMinute?: number;
  gameId?: string;
  minSessionMinutes?: string;
  maxSessionMinutes?: string;
  startAt?: string;
  endAt?: string;
  minGpuVram?: number | null;
  minCpuCores?: number | null;
  minRamGb?: number | null;
  minDownloadMbps?: number | null;
  minUploadMbps?: number | null;
  recGpuVram?: number | null;
  recCpuCores?: number | null;
  recRamGb?: number | null;
  recDownloadMbps?: number | null;
  recUploadMbps?: number | null;
  requiredTier?: "min" | "recommended";
};

type Message = {
  role: "user" | "assistant";
  content: string;
};

type AvailableGame = {
  id: string;
  title: string;
};

type Props = {
  ownerToken: string;
  currentFormState: QuotaFormState;
  availableGames: AvailableGame[];
  onFormPatch: (patch: QuotaFormPatch) => void;
};

export const QUOTA_AI_CHAT_STARTERS = [
  "Спонсирую плейтест Cyberpunk — бюджет 50000 LZT, хосту 100 LZT/мин",
  "Беру 10% royalty из доли хоста для своих модов",
  "Бесплатные 30 минут новичкам — спонсорская квота, игроку 5 LZT/мин",
] as const;

export function shouldSendQuotaMessageOnEnter(key: string, shiftKey: boolean): boolean {
  return key === "Enter" && !shiftKey;
}

export function canSendQuotaMessage(text: string, loading: boolean): boolean {
  return text.trim().length > 0 && !loading;
}

export function hasQuotaFormPatch(patch: QuotaFormPatch | null | undefined): boolean {
  return patch != null && Object.keys(patch).length > 0;
}

const panelStyle = {
  background: "#0a1018",
  border: "1px solid rgba(255,255,255,0.06)",
};
const msgUserStyle = {
  background: "rgba(14,165,233,0.12)",
  border: "1px solid rgba(14,165,233,0.2)",
};
const msgAiStyle = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.06)",
};
const inputStyle = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#e2e8f0",
  resize: "none" as const,
};

export function QuotaAiChat({ ownerToken, currentFormState, availableGames, onFormPatch }: Props) {
  const quotaAiChat = useQuotaAiChat();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const loading = quotaAiChat.isPending;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!canSendQuotaMessage(text, loading)) return;
    const trimmed = text.trim();

    const userMsg: Message = { role: "user", content: trimmed };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");

    try {
      const data = await quotaAiChat.mutateAsync({
        data: {
          ownerToken,
          messages: nextMessages,
          currentFormState: currentFormState as ApiQuotaFormState,
          availableGames,
        },
      });
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      if (hasQuotaFormPatch(data.formPatch as QuotaFormPatch)) {
        onFormPatch(data.formPatch as QuotaFormPatch);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Ошибка: ${formatApiError(err, "Не удалось связаться с ИИ. Попробуй ещё раз.")}`,
        },
      ]);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (shouldSendQuotaMessageOnEnter(e.key, e.shiftKey)) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div
      className="rounded-xl flex flex-col"
      style={{ ...panelStyle, height: "100%", minHeight: 480 }}
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
        <Sparkles className="h-4 w-4 text-sky-400" />
        <span className="text-sm font-semibold text-white">ИИ-помощник</span>
        <span className="text-xs text-slate-500 ml-1">— опиши квоту словами</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ minHeight: 0 }}>
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-500 text-center py-2">
              Напиши, что хочешь создать, или выбери пример:
            </p>
            {QUOTA_AI_CHAT_STARTERS.map((s, i) => (
              <button
                key={i}
                onClick={() => sendMessage(s)}
                className="w-full text-left text-xs rounded-lg px-3 py-2 transition-all cursor-pointer"
                style={{
                  background: "rgba(14,165,233,0.06)",
                  border: "1px solid rgba(14,165,233,0.15)",
                  color: "#94a3b8",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(14,165,233,0.12)";
                  (e.currentTarget as HTMLElement).style.color = "#e2e8f0";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(14,165,233,0.06)";
                  (e.currentTarget as HTMLElement).style.color = "#94a3b8";
                }}
              >
                {s}
              </button>
            ))}
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className="rounded-lg px-3 py-2 text-sm"
              style={m.role === "user" ? msgUserStyle : msgAiStyle}
            >
              {m.role === "assistant" && (
                <div className="flex items-center gap-1 mb-1">
                  <Bot className="h-3 w-3 text-sky-400" />
                  <span className="text-xs text-sky-400 font-medium">ИИ</span>
                </div>
              )}
              <p className="text-slate-200 whitespace-pre-wrap">{m.content}</p>
            </div>
          ))
        )}
        {loading && (
          <div className="rounded-lg px-3 py-2 text-sm" style={msgAiStyle}>
            <div className="flex items-center gap-2 text-slate-400">
              <Loader2 className="h-3 w-3 animate-spin text-sky-400" />
              <span className="text-xs">Думаю…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 pb-4 pt-2 border-t border-white/5 flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Напиши запрос… (Enter — отправить)"
          rows={2}
          style={inputStyle}
          className="flex-1 text-sm"
          disabled={loading}
        />
        <Button
          type="button"
          size="sm"
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim()}
          style={{ background: "#0ea5e9", color: "#fff", alignSelf: "flex-end" }}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
