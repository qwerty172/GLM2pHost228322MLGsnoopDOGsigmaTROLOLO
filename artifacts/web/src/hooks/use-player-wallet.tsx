import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { registerPlayer, upgradeGuestPlayer } from "@workspace/api-client-react";

export const PLAYER_WALLET_STORAGE_KEY = "streamline.playerWalletToken";
export const PLAYER_GUEST_STORAGE_KEY = "streamline.playerIsGuest";

const GUEST_REGISTER_ERROR = "Не удалось создать гостевой кошелёк";

interface PlayerWalletState {
  playerWalletToken: string | null;
  isGuest: boolean;
  isRegistering: boolean;
  registerError: string | null;
  registerGuest: () => Promise<string | null>;
  upgradeGuest: (displayName: string) => Promise<boolean>;
}

export function readIsGuestFromStorage(guestKeyValue: string | null): boolean {
  return guestKeyValue === "true";
}

export async function registerGuestWallet(
  register: typeof registerPlayer = registerPlayer,
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
): Promise<{ token: string } | { existing: string } | { error: string }> {
  const existing = storage.getItem(PLAYER_WALLET_STORAGE_KEY);
  if (existing) return { existing };

  try {
    const data = await register({ guest: true });
    const token = data.playerToken;
    storage.setItem(PLAYER_WALLET_STORAGE_KEY, token);
    storage.setItem(PLAYER_GUEST_STORAGE_KEY, "true");
    return { token };
  } catch {
    return { error: GUEST_REGISTER_ERROR };
  }
}

export async function upgradeGuestWallet(
  displayName: string,
  isGuest: boolean,
  upgrade: typeof upgradeGuestPlayer = upgradeGuestPlayer,
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> = localStorage,
): Promise<{ token: string } | null> {
  const guestToken = storage.getItem(PLAYER_WALLET_STORAGE_KEY);
  if (!guestToken || !isGuest) return null;
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

export function usePlayerWallet(): PlayerWalletState {
  const [playerWalletToken, setToken] = useState<string | null>(() =>
    localStorage.getItem(PLAYER_WALLET_STORAGE_KEY),
  );
  const [isGuest, setIsGuest] = useState<boolean>(() =>
    readIsGuestFromStorage(localStorage.getItem(PLAYER_GUEST_STORAGE_KEY)),
  );
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  const registerGuest = useCallback(async (): Promise<string | null> => {
    if (isRegistering) return null;

    setIsRegistering(true);
    setRegisterError(null);
    try {
      const result = await registerGuestWallet();
      if ("existing" in result) return result.existing;
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
    const result = await upgradeGuestWallet(displayName, isGuest);
    if (!result) return false;
    setToken(result.token);
    setIsGuest(false);
    return true;
  }, [isGuest]);

  // Keep isGuest in sync if token changes externally (e.g. claim-guest sets a
  // full-account token).
  useEffect(() => {
    setIsGuest(readIsGuestFromStorage(localStorage.getItem(PLAYER_GUEST_STORAGE_KEY)));
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
