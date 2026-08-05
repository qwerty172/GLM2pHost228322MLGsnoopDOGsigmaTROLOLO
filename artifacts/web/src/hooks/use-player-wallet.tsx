import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { registerPlayer, upgradeGuestPlayer } from "@workspace/api-client-react";

export const PLAYER_WALLET_STORAGE_KEY = "streamline.playerWalletToken";
export const PLAYER_IS_GUEST_STORAGE_KEY = "streamline.playerIsGuest";
export const REGISTER_GUEST_ERROR_MSG = "Не удалось создать гостевой кошелёк";

export function isGuestStoredValue(stored: string | null): boolean {
  return stored === "true";
}

export async function callRegisterGuestPlayer(
  register: typeof registerPlayer = registerPlayer,
): Promise<string | null> {
  try {
    const data = await register({ guest: true });
    return data.playerToken ?? null;
  } catch {
    return null;
  }
}

export async function callUpgradeGuestPlayer(
  guestToken: string,
  displayName: string,
  upgrade: typeof upgradeGuestPlayer = upgradeGuestPlayer,
): Promise<string | null> {
  try {
    const data = await upgrade({ guestToken, displayName: displayName.trim() });
    return data.playerToken ?? null;
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
  const [isGuest, setIsGuest] = useState<boolean>(() =>
    isGuestStoredValue(localStorage.getItem(PLAYER_IS_GUEST_STORAGE_KEY)),
  );
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  const registerGuest = useCallback(async (): Promise<string | null> => {
    if (isRegistering) return null;
    const existing = localStorage.getItem(PLAYER_WALLET_STORAGE_KEY);
    if (existing) return existing;

    setIsRegistering(true);
    setRegisterError(null);
    try {
      const token = await callRegisterGuestPlayer();
      if (!token) {
        setRegisterError(REGISTER_GUEST_ERROR_MSG);
        toast.error(REGISTER_GUEST_ERROR_MSG);
        return null;
      }
      localStorage.setItem(PLAYER_WALLET_STORAGE_KEY, token);
      localStorage.setItem(PLAYER_IS_GUEST_STORAGE_KEY, "true");
      setToken(token);
      setIsGuest(true);
      return token;
    } finally {
      setIsRegistering(false);
    }
  }, [isRegistering]);

  const upgradeGuest = useCallback(async (displayName: string): Promise<boolean> => {
    const guestToken = localStorage.getItem(PLAYER_WALLET_STORAGE_KEY);
    if (!guestToken || !isGuest) return false;
    const token = await callUpgradeGuestPlayer(guestToken, displayName);
    if (!token) return false;
    localStorage.setItem(PLAYER_WALLET_STORAGE_KEY, token);
    localStorage.removeItem(PLAYER_IS_GUEST_STORAGE_KEY);
    setToken(token);
    setIsGuest(false);
    return true;
  }, [isGuest]);

  // Keep isGuest in sync if token changes externally (e.g. claim-guest sets a
  // full-account token).
  useEffect(() => {
    const stored = localStorage.getItem(PLAYER_IS_GUEST_STORAGE_KEY);
    setIsGuest(isGuestStoredValue(stored));
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
