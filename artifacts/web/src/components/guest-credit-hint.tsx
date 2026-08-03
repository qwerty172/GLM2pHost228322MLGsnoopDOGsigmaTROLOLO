import { Zap } from "lucide-react";

const GUEST_CREDIT_LZT = 500;

export function GuestCreditHint({ className = "" }: { className?: string }) {
  return (
    <div
      className={`inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full ${className}`}
      style={{
        background: "rgba(16,185,129,0.08)",
        color: "#6ee7b7",
        border: "1px solid rgba(16,185,129,0.25)",
      }}
      data-testid="guest-credit-hint"
    >
      <Zap className="h-3.5 w-3.5 shrink-0" />
      <span>
        {GUEST_CREDIT_LZT.toLocaleString("ru-RU")} LZT гостевого кредита — играй без регистрации
      </span>
    </div>
  );
}
