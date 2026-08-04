import { Gift } from "lucide-react";
import { usePlayerWallet } from "@/hooks/use-player-wallet";

const GUEST_WELCOME_LZT = 500;

type GuestCreditHintProps = {
  className?: string;
  compact?: boolean;
};

/** Подсказка о приветственном бонусе для гостевого кошелька. */
export function GuestCreditHint({ className = "", compact = false }: GuestCreditHintProps) {
  const { isGuest, playerWalletToken, isRegistering } = usePlayerWallet();

  if (!playerWalletToken && !isRegistering) return null;
  if (!isGuest && playerWalletToken) return null;

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[11px] text-teal-300/90 ${className}`}
        data-testid="guest-credit-hint"
      >
        <Gift className="w-3 h-3 shrink-0" />
        {isRegistering ? "Создаём кошелёк…" : `${GUEST_WELCOME_LZT} LZT на старт`}
      </span>
    );
  }

  return (
    <div
      className={`flex items-start gap-2.5 rounded-lg px-3.5 py-2.5 text-xs ${className}`}
      style={{
        background: "rgba(45,212,191,0.06)",
        border: "1px solid rgba(45,212,191,0.18)",
        color: "#99f6e4",
      }}
      data-testid="guest-credit-hint"
    >
      <Gift className="w-4 h-4 shrink-0 mt-0.5 text-teal-400" />
      <div>
        <p className="font-medium text-teal-200">
          {isRegistering
            ? "Создаём гостевой кошелёк…"
            : `${GUEST_WELCOME_LZT} LZT — приветственный бонус`}
        </p>
        <p className="text-teal-400/70 mt-0.5 leading-relaxed">
          Можно сразу подключиться к хосту. Регистрация не нужна — сохраним прогресс в браузере.
        </p>
      </div>
    </div>
  );
}
