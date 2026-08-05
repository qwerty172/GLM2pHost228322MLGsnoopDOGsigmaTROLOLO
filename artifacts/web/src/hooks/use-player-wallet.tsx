import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { registerPlayer, upgradeGuestPlayer } from "@workspace/api-client-react";

export const PLAYER_WALLET_STORAGE_KEY = "streamline.playerWalletToken";
export const PLAYER_GUEST_STORAGE_KEY = "streamline.playerIsGuest";

export function readStoredPlayerWalletToken(): string | null {
  return localStorage.getItem(PLAYER_WALLET_STORAGE_KEY);
}

export function readStoredIsGuest(): boolean {
  return localStorage.getItem(PLAYER_GUEST_STORAGE_KEY) === "true";
}

export async function registerGuestPlayerWallet(
  register: typeof registerPlayer = registerPlayer,
): Promise<{ token: string; created: boolean } | { error: string }> {
  const existing = localStorage.getItem(PLAYER_WALLET_STORAGE_KEY);
  if (existing) return { token: existing, created: false };

  try {
    const data = await register({ guest: true });
    const token = data.playerToken;
    localStorage.setItem(PLAYER_WALLET_STORAGE_KEY, token);
    localStorage.setItem(PLAYER_GUEST_STORAGE_KEY, "true");
    return { token, created: true };
  } catch {
    return { error: "Не удалось создать гостевой кошелёк" };
  }
}

export async function upgradeGuestPlayerWallet(
  displayName: string,
  isGuest: boolean,
  upgrade: typeof upgradeGuestPlayer = upgradeGuestPlayer,
): Promise<string | false> {
  const guestToken = localStorage.getItem(PLAYER_WALLET_STORAGE_KEY);
  if (!guestToken || !isGuest) return false;
  try {
    const data = await upgrade({
      guestToken,
      displayName: displayName.trim(),
    });
    localStorage.setItem(PLAYER_WALLET_STORAGE_KEY, data.playerToken);
    localStorage.removeItem(PLAYER_GUEST_STORAGE_KEY);
    return data.playerToken;
  } catch {
    return false;
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
    readStoredPlayerWalletToken(),
  );
  const [isGuest, setIsGuest] = useState<boolean>(() => readStoredIsGuest());
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  const registerGuest = useCallback(async (): Promise<string | null> => {
    if (isRegistering) return null;

    setIsRegistering(true);
    setRegisterError(null);
    try {
      const result = await registerGuestPlayerWallet();
      if ("error" in result) {
        setRegisterError(result.error);
        toast.error(result.error);
        return null;
      }
      if (result.created) {
        setToken(result.token);
        setIsGuest(true);
      }
      return result.token;
    } finally {
      setIsRegistering(false);
    }
  }, [isRegistering]);

  const upgradeGuest = useCallback(async (displayName: string): Promise<boolean> => {
    const upgraded = await upgradeGuestPlayerWallet(displayName, isGuest);
    if (!upgraded) return false;
    setToken(upgraded);
    setIsGuest(false);
    return true;
  }, [isGuest]);

  // Keep isGuest in sync if token changes externally (e.g. claim-guest sets a
  // full-account token).
  useEffect(() => {
    setIsGuest(readStoredIsGuest());
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
