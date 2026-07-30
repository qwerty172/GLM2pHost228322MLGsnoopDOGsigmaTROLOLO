import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getAgentTroubleshootGuide,
  type AgentState,
  type HeartbeatState,
} from "@/lib/agent-troubleshoot";

type AgentTroubleshootPanelProps = {
  agent: AgentState;
  heartbeat: HeartbeatState;
  onRetryPing?: () => void;
  retrying?: boolean;
  defaultOpen?: boolean;
};

export function AgentTroubleshootPanel({
  agent,
  heartbeat,
  onRetryPing,
  retrying,
  defaultOpen,
}: AgentTroubleshootPanelProps) {
  if (agent.status === "checking") return null;

  const guide = getAgentTroubleshootGuide(agent, heartbeat);

  return (
    <details
      className="w-full mt-3 rounded-lg"
      style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)" }}
      data-testid="agent-troubleshoot"
      open={defaultOpen}
    >
      <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-300 select-none px-3 py-2">
        {guide.title} — диагностика и чеклист
      </summary>
      <div className="px-3 pb-3 space-y-3">
        <p className="text-xs text-slate-400" data-testid="agent-troubleshoot-summary">
          {guide.summary}
        </p>

        {onRetryPing && agent.status === "offline" && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs border-white/10 text-slate-300"
            onClick={onRetryPing}
            disabled={retrying}
            data-testid="button-retry-agent-ping"
          >
            <RefreshCw className={`h-3 w-3 ${retrying ? "animate-spin" : ""}`} />
            Проверить localhost снова
          </Button>
        )}

        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">
            Шаги
          </p>
          <ol className="space-y-1 text-xs text-slate-400 list-decimal pl-4">
            {guide.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">
            Симптом → решение
          </p>
          <ul className="space-y-2">
            {guide.items.map((item) => (
              <li
                key={item.symptom}
                className="text-xs rounded-md px-2 py-1.5"
                style={{ background: "rgba(255,255,255,0.02)" }}
              >
                <span className="text-slate-300 font-medium">{item.symptom}</span>
                <span className="text-slate-500"> — </span>
                <span className="text-slate-400">{item.fix}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}
