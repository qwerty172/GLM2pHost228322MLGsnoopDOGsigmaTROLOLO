import { Gift } from "lucide-react";
import { usePlayerWallet } from "@/hooks/use-player-wallet";

const WELCOME_BONUS_LZT = 500;

/** Подсказка о гостевом бонусе — не мешает, можно закрыть. */
export function GuestCreditHint({ className = "" }: { className?: string }) {
  const { playerWalletToken, isGuest } = usePlayerWallet();

  if (playerWalletToken && !isGuest) return null;

  return (
    <div
      className={`flex items-start gap-2.5 rounded-lg px-3.5 py-2.5 text-xs ${className}`}
      style={{
        background: "rgba(14,165,233,0.06)",
        border: "1px solid rgba(14,165,233,0.18)",
        color: "#94a3b8",
      }}
      data-testid="guest-credit-hint"
    >
      <Gift className="h-4 w-4 shrink-0 text-sky-400 mt-0.5" />
      <p>
        <span className="font-semibold text-sky-300">{WELCOME_BONUS_LZT} LZT</span>
        {" "}на первую игру — гостевой кошелёк создаётся автоматически, регистрация не нужна.
      </p>
    </div>
  );
}
