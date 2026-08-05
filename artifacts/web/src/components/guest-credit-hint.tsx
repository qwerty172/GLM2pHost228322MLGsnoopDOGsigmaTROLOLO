import { Gift } from "lucide-react";
import { usePlayerWallet } from "@/hooks/use-player-wallet";
import {
  useGetWallet,
  getGetWalletQueryKey,
} from "@workspace/api-client-react";

/** Синхронизировано с GUEST_WELCOME_BONUS_LZT в api-server/players.ts */
export const GUEST_WELCOME_BONUS_LZT = 500;

type Variant = "banner" | "compact";

interface Props {
  variant?: Variant;
  className?: string;
}

/**
 * Подсказка «500 LZT бесплатно» — показываем, пока у гостя есть welcome-бонус
 * или кошелёк ещё не создан.
 */
export function GuestCreditHint({ variant = "banner", className = "" }: Props) {
  const { playerWalletToken, isGuest } = usePlayerWallet();
  const { data: wallet } = useGetWallet(playerWalletToken ?? "", {
    query: {
      enabled: !!playerWalletToken,
      retry: false,
      staleTime: 30_000,
      queryKey: getGetWalletQueryKey(playerWalletToken ?? ""),
    },
  });

  const blueLzt = wallet?.internalBalanceLzt ?? 0;
  const greenLzt = wallet?.withdrawableBalanceLzt ?? 0;

  // Показываем гостям и тем, кто ещё не создал кошелёк.
  if (playerWalletToken && !isGuest) return null;
  // Гость потратил весь welcome-бонус — подсказка больше не нужна.
  if (playerWalletToken && isGuest && blueLzt + greenLzt <= 0) return null;

  const text =
    variant === "compact"
      ? `${GUEST_WELCOME_BONUS_LZT} LZT бесплатно`
      : `${GUEST_WELCOME_BONUS_LZT} LZT на первую игру — без регистрации и карты`;

  if (variant === "compact") {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${className}`}
        style={{
          background: "rgba(16,185,129,0.1)",
          color: "#34d399",
          border: "1px solid rgba(16,185,129,0.25)",
        }}
        data-testid="guest-credit-hint"
      >
        <Gift className="h-3 w-3" />
        {text}
      </span>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${className}`}
      style={{
        background: "rgba(16,185,129,0.06)",
        border: "1px solid rgba(16,185,129,0.2)",
        color: "#6ee7b7",
      }}
      data-testid="guest-credit-hint"
    >
      <Gift className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
      <span>{text}</span>
    </div>
  );
}
