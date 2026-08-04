import { Sparkles } from "lucide-react";
import { usePlayerWallet } from "@/hooks/use-player-wallet";

const GUEST_BONUS_LZT = 500;

/** Подсказка о гостевом бонусе — не блокирует основной поток. */
export function GuestCreditHint({ className = "" }: { className?: string }) {
  const { playerWalletToken, isGuest } = usePlayerWallet();

  if (playerWalletToken && !isGuest) return null;

  const text = playerWalletToken && isGuest
    ? `На балансе ${GUEST_BONUS_LZT} LZT — хватит на первую игру`
    : `Гостевой вход — ${GUEST_BONUS_LZT} LZT в подарок, без регистрации`;

  return (
    <div
      className={`inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full ${className}`}
      style={{
        background: "rgba(14,165,233,0.08)",
        color: "#7dd3fc",
        border: "1px solid rgba(14,165,233,0.2)",
      }}
      data-testid="guest-credit-hint"
    >
      <Sparkles className="w-3.5 h-3.5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}
