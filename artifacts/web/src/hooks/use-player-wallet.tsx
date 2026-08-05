import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { registerPlayer, upgradeGuestPlayer } from "@workspace/api-client-react";

export const PLAYER_WALLET_STORAGE_KEY = "streamline.playerWalletToken";
export const PLAYER_GUEST_STORAGE_KEY = "streamline.playerIsGuest";

const STORAGE_KEY = PLAYER_WALLET_STORAGE_KEY;
const GUEST_KEY = PLAYER_GUEST_STORAGE_KEY;

export function readIsGuestFromStorage(guestKeyValue: string | null): boolean {
  return guestKeyValue === "true";
}

export async function registerGuestWallet(
  register: typeof registerPlayer,
  storage: Pick<Storage, "getItem" | "setItem">,
): Promise<{ token: string } | { error: string }> {
  const existing = storage.getItem(STORAGE_KEY);
  if (existing) return { token: existing };

  try {
    const data = await register({ guest: true });
    const token = data.playerToken;
    storage.setItem(STORAGE_KEY, token);
    storage.setItem(GUEST_KEY, "true");
    return { token };
  } catch {
    return { error: "Не удалось создать гостевой кошелёк" };
  }
}

export async function upgradeGuestWallet(
  upgrade: typeof upgradeGuestPlayer,
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  displayName: string,
  isGuest: boolean,
): Promise<{ token: string } | false> {
  const guestToken = storage.getItem(STORAGE_KEY);
  if (!guestToken || !isGuest) return false;

  try {
    const data = await upgrade({ guestToken, displayName: displayName.trim() });
    storage.setItem(STORAGE_KEY, data.playerToken);
    storage.removeItem(GUEST_KEY);
    return { token: data.playerToken };
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
    localStorage.getItem(STORAGE_KEY),
  );
  const [isGuest, setIsGuest] = useState<boolean>(() =>
    readIsGuestFromStorage(localStorage.getItem(GUEST_KEY)),
  );
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  const registerGuest = useCallback(async (): Promise<string | null> => {
    if (isRegistering) return null;
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;

    setIsRegistering(true);
    setRegisterError(null);
    try {
      const result = await registerGuestWallet(registerPlayer, localStorage);
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
    const result = await upgradeGuestWallet(
      upgradeGuestPlayer,
      localStorage,
      displayName,
      isGuest,
    );
    if (!result) return false;
    setToken(result.token);
    setIsGuest(false);
    return true;
  }, [isGuest]);

  // Keep isGuest in sync if token changes externally (e.g. claim-guest sets a
  // full-account token).
  useEffect(() => {
    const stored = localStorage.getItem(GUEST_KEY);
    setIsGuest(readIsGuestFromStorage(stored));
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
