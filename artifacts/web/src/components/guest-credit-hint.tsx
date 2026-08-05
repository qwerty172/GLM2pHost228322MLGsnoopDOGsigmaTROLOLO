import { Gift } from "lucide-react";

const GUEST_WELCOME_BONUS_LZT = 500;

type GuestCreditHintProps = {
  className?: string;
  compact?: boolean;
};

/** Подсказка о приветственном бонусе — показываем гостям до первой игры. */
export function GuestCreditHint({ className = "", compact = false }: GuestCreditHintProps) {
  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[11px] text-teal-400 ${className}`}
        data-testid="guest-credit-hint"
      >
        <Gift className="h-3 w-3" />
        {GUEST_WELCOME_BONUS_LZT} LZT на старт
      </span>
    );
  }

  return (
    <div
      className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${className}`}
      style={{
        background: "rgba(45,212,191,0.06)",
        border: "1px solid rgba(45,212,191,0.18)",
        color: "#94a3b8",
      }}
      data-testid="guest-credit-hint"
    >
      <Gift className="h-4 w-4 text-teal-400 shrink-0 mt-0.5" />
      <p>
        <span className="text-teal-300 font-medium">
          {GUEST_WELCOME_BONUS_LZT} LZT
        </span>{" "}
        на счёте — хватит на ~{Math.floor(GUEST_WELCOME_BONUS_LZT / 10)} минут игры.
        Регистрация не нужна.
      </p>
    </div>
  );
}
