import { useEffect } from "react";
import { usePlayerWallet } from "@/hooks/use-player-wallet";

/** Тихо создаёт гостевой кошелёк при первом визите — кнопки «Играть» работают без ожидания. */
export function PlayerWalletBootstrap() {
  const { playerWalletToken, registerGuest, isRegistering } = usePlayerWallet();

  useEffect(() => {
    if (!playerWalletToken && !isRegistering) {
      void registerGuest();
    }
  }, [playerWalletToken, registerGuest, isRegistering]);

  return null;
}
