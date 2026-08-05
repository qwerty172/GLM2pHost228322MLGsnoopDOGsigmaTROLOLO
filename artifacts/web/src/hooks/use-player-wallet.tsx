import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { registerPlayer, upgradeGuestPlayer } from "@workspace/api-client-react";

export const PLAYER_WALLET_STORAGE_KEY = "streamline.playerWalletToken";
export const PLAYER_GUEST_STORAGE_KEY = "streamline.playerIsGuest";

export function readPlayerWalletToken(storage: Storage = localStorage): string | null {
  return storage.getItem(PLAYER_WALLET_STORAGE_KEY);
}

export function readIsGuestPlayer(storage: Storage = localStorage): boolean {
  return storage.getItem(PLAYER_GUEST_STORAGE_KEY) === "true";
}

export async function registerGuestPlayerWallet(
  register: typeof registerPlayer = registerPlayer,
  storage: Storage = localStorage,
): Promise<{ token: string } | { error: string }> {
  const existing = storage.getItem(PLAYER_WALLET_STORAGE_KEY);
  if (existing) return { token: existing };

  try {
    const data = await register({ guest: true });
    const token = data.playerToken;
    storage.setItem(PLAYER_WALLET_STORAGE_KEY, token);
    storage.setItem(PLAYER_GUEST_STORAGE_KEY, "true");
    return { token };
  } catch {
    return { error: "Не удалось создать гостевой кошелёк" };
  }
}

export async function upgradeGuestPlayerWallet(
  displayName: string,
  storage: Storage = localStorage,
  upgrade: typeof upgradeGuestPlayer = upgradeGuestPlayer,
): Promise<{ token: string } | null> {
  const guestToken = storage.getItem(PLAYER_WALLET_STORAGE_KEY);
  if (!guestToken || storage.getItem(PLAYER_GUEST_STORAGE_KEY) !== "true") return null;

  try {
    const data = await upgrade({
      guestToken,
      displayName: displayName.trim(),
    });
    storage.setItem(PLAYER_WALLET_STORAGE_KEY, data.playerToken);
    storage.removeItem(PLAYER_GUEST_STORAGE_KEY);
    return { token: data.playerToken };
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
    readPlayerWalletToken(),
  );
  const [isGuest, setIsGuest] = useState<boolean>(() => readIsGuestPlayer());
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
      setToken(result.token);
      setIsGuest(true);
      return result.token;
    } finally {
      setIsRegistering(false);
    }
  }, [isRegistering]);

  const upgradeGuest = useCallback(async (displayName: string): Promise<boolean> => {
    if (!isGuest) return false;
    const result = await upgradeGuestPlayerWallet(displayName);
    if (!result) return false;
    setToken(result.token);
    setIsGuest(false);
    return true;
  }, [isGuest]);

  // Keep isGuest in sync if token changes externally (e.g. claim-guest sets a
  // full-account token).
  useEffect(() => {
    setIsGuest(readIsGuestPlayer());
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
