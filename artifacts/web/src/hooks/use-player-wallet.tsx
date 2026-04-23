import { useEffect, useState } from "react";
import { useRegisterPlayer } from "@workspace/api-client-react";

const STORAGE_KEY = "streamline.playerWalletToken";

export function usePlayerWallet() {
  const [playerWalletToken, setToken] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEY),
  );
  const register = useRegisterPlayer();

  useEffect(() => {
    if (playerWalletToken || register.isPending) return;
    register.mutate(
      { data: { displayName: "Guest Player" } },
      {
        onSuccess: (player) => {
          localStorage.setItem(STORAGE_KEY, player.playerToken);
          setToken(player.playerToken);
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerWalletToken]);

  return { playerWalletToken, isRegistering: register.isPending };
}
