import { Link } from "wouter";
import { Gift, Zap } from "lucide-react";
import { useEffect } from "react";
import {
  useGetWallet,
  getGetWalletQueryKey,
} from "@workspace/api-client-react";
import { usePlayerWallet } from "@/hooks/use-player-wallet";

/** Гостевой кредит на API — 500 LZT (≈2.5 USDT). */
export const GUEST_CREDIT_LIMIT_LZT = 500;

type Props = {
  className?: string;
  /** Компактный вариант для списков */
  compact?: boolean;
};

/**
 * Подсказка «играй сразу»: автоматически создаёт гостевой кошелёк и показывает
 * доступный кредит. Регистрация и пополнение — опционально, на потом.
 */
export function GuestCreditHint({ className = "", compact = false }: Props) {
  const {
    playerWalletToken,
    isGuest,
    registerGuest,
    isRegistering,
  } = usePlayerWallet();

  useEffect(() => {
    if (!playerWalletToken && !isRegistering) {
      void registerGuest();
    }
  }, [playerWalletToken, isRegistering, registerGuest]);

  const { data: wallet } = useGetWallet(playerWalletToken ?? "", {
    query: {
      enabled: !!playerWalletToken,
      retry: false,
      staleTime: 60_000,
      queryKey: getGetWalletQueryKey(playerWalletToken ?? ""),
    },
  });

  const creditLimit =
    wallet?.creditLimitLzt ??
    (isGuest || !playerWalletToken ? GUEST_CREDIT_LIMIT_LZT : 0);
  const creditDebt = wallet?.creditDebtLzt ?? 0;
  const creditLeft = Math.max(0, creditLimit - creditDebt);

  if (compact) {
    return (
      <p
        className={`text-xs text-slate-500 ${className}`}
        data-testid="guest-credit-hint-compact"
      >
        <Gift className="inline w-3 h-3 mr-1 text-teal-400" />
        {isRegistering
          ? "Создаём гостевой кошелёк…"
          : `Пробный кредит: ${creditLeft.toLocaleString("ru-RU")} LZT — без регистрации`}
      </p>
    );
  }

  return (
    <div
      className={`rounded-lg px-4 py-3 flex flex-wrap items-center gap-3 text-sm ${className}`}
      style={{
        background: "rgba(45,212,191,0.06)",
        border: "1px solid rgba(45,212,191,0.18)",
      }}
      data-testid="guest-credit-hint"
    >
      <div className="flex items-center gap-2 min-w-0">
        <Zap className="w-4 h-4 text-teal-400 shrink-0" />
        <div className="min-w-0">
          <p className="text-white font-medium leading-tight">
            {isRegistering
              ? "Подготавливаем пробный кошелёк…"
              : "Играй сразу — регистрация не нужна"}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {creditLeft.toLocaleString("ru-RU")} LZT на пробу
            {creditLimit > 0 && (
              <span className="text-slate-500">
                {" "}
                (кредит до {creditLimit.toLocaleString("ru-RU")} LZT)
              </span>
            )}
            . Пополнение и сохранение аккаунта — когда захочешь.
          </p>
        </div>
      </div>
      {!isGuest && playerWalletToken ? null : (
        <Link
          href="/wallet"
          className="text-xs text-sky-400 hover:text-sky-300 shrink-0 ml-auto"
        >
          Кошелёк →
        </Link>
      )}
    </div>
  );
}
