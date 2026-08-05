import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { registerPlayer, upgradeGuestPlayer } from "@workspace/api-client-react";

export const PLAYER_WALLET_STORAGE_KEY = "streamline.playerWalletToken";
export const PLAYER_GUEST_STORAGE_KEY = "streamline.playerIsGuest";

export function readIsGuestFromStorage(
  storage: Pick<Storage, "getItem"> = localStorage,
): boolean {
  return storage.getItem(PLAYER_GUEST_STORAGE_KEY) === "true";
}

export async function registerGuestWallet(
  register: typeof registerPlayer = registerPlayer,
): Promise<{ token: string } | { error: string }> {
  try {
    const data = await register({ guest: true });
    return { token: data.playerToken };
  } catch {
    return { error: "Не удалось создать гостевой кошелёк" };
  }
}

export async function upgradeGuestWallet(
  displayName: string,
  guestToken: string | null,
  isGuest: boolean,
  upgrade: typeof upgradeGuestPlayer = upgradeGuestPlayer,
): Promise<string | null> {
  if (!guestToken || !isGuest) return null;
  try {
    const data = await upgrade({
      guestToken,
      displayName: displayName.trim(),
    });
    return data.playerToken;
  } catch {
    return null;
  }
}

interface PlayerWalletState {
  playerWalletToken: string | null;
  isGuest: boolean;
  isRegistering: boolean;
  registerError: string | null;
  registerGuest: () => Promise<string | null>;
  upgradeGuest: (displayName: string) => Promise<boolean>;
}

export function usePlayerWallet(): PlayerWalletState {
  const [playerWalletToken, setToken] = useState<string | null>(() =>
    localStorage.getItem(PLAYER_WALLET_STORAGE_KEY),
  );
  const [isGuest, setIsGuest] = useState<boolean>(() => readIsGuestFromStorage());
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  const registerGuest = useCallback(async (): Promise<string | null> => {
    if (isRegistering) return null;
    const existing = localStorage.getItem(PLAYER_WALLET_STORAGE_KEY);
    if (existing) return existing;

    setIsRegistering(true);
    setRegisterError(null);
    try {
      const result = await registerGuestWallet();
      if ("error" in result) {
        setRegisterError(result.error);
        toast.error(result.error);
        return null;
      }
      localStorage.setItem(PLAYER_WALLET_STORAGE_KEY, result.token);
      localStorage.setItem(PLAYER_GUEST_STORAGE_KEY, "true");
      setToken(result.token);
      setIsGuest(true);
      return result.token;
    } finally {
      setIsRegistering(false);
    }
  }, [isRegistering]);

  const upgradeGuest = useCallback(async (displayName: string): Promise<boolean> => {
    const guestToken = localStorage.getItem(PLAYER_WALLET_STORAGE_KEY);
    const token = await upgradeGuestWallet(displayName, guestToken, isGuest);
    if (!token) return false;
    localStorage.setItem(PLAYER_WALLET_STORAGE_KEY, token);
    localStorage.removeItem(PLAYER_GUEST_STORAGE_KEY);
    setToken(token);
    setIsGuest(false);
    return true;
  }, [isGuest]);

  // Keep isGuest in sync if token changes externally (e.g. claim-guest sets a
  // full-account token).
  useEffect(() => {
    setIsGuest(readIsGuestFromStorage());
  }, [playerWalletToken]);

  return {
    playerWalletToken,
    isGuest,
    isRegistering,
    registerError,
    registerGuest,
    upgradeGuest,
  };
}
