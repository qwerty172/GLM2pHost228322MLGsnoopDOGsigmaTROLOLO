import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { registerPlayer, upgradeGuestPlayer } from "@workspace/api-client-react";

export const PLAYER_WALLET_STORAGE_KEY = "streamline.playerWalletToken";
export const PLAYER_GUEST_STORAGE_KEY = "streamline.playerIsGuest";
export const GUEST_REGISTER_ERROR_MSG = "Не удалось создать гостевой кошелёк";

export function readGuestFlagFromStorage(stored: string | null): boolean {
  return stored === "true";
}

export async function registerGuestPlayerWallet(
  getExistingToken: () => string | null,
  register: (body: { guest: true }) => Promise<{ playerToken: string }> = registerPlayer,
): Promise<{ token: string | null; error: string | null }> {
  const existing = getExistingToken();
  if (existing) return { token: existing, error: null };
  try {
    const data = await register({ guest: true });
    return { token: data.playerToken, error: null };
  } catch {
    return { token: null, error: GUEST_REGISTER_ERROR_MSG };
  }
}

export async function upgradeGuestPlayerWallet(
  guestToken: string | null,
  isGuest: boolean,
  displayName: string,
  upgrade: (body: {
    guestToken: string;
    displayName: string;
  }) => Promise<{ playerToken: string }> = upgradeGuestPlayer,
): Promise<{ token: string | null; upgraded: boolean }> {
  if (!guestToken || !isGuest) return { token: null, upgraded: false };
  try {
    const data = await upgrade({ guestToken, displayName: displayName.trim() });
    return { token: data.playerToken, upgraded: true };
  } catch {
    return { token: null, upgraded: false };
  }
}

export function persistGuestWalletToken(
  storage: Pick<Storage, "setItem">,
  token: string,
): void {
  storage.setItem(PLAYER_WALLET_STORAGE_KEY, token);
  storage.setItem(PLAYER_GUEST_STORAGE_KEY, "true");
}

export function persistUpgradedWalletToken(
  storage: Pick<Storage, "setItem" | "removeItem">,
  token: string,
): void {
  storage.setItem(PLAYER_WALLET_STORAGE_KEY, token);
  storage.removeItem(PLAYER_GUEST_STORAGE_KEY);
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
    readGuestFlagFromStorage(localStorage.getItem(PLAYER_GUEST_STORAGE_KEY)),
  );
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  const registerGuest = useCallback(async (): Promise<string | null> => {
    if (isRegistering) return null;

    setIsRegistering(true);
    setRegisterError(null);
    try {
      const { token, error } = await registerGuestPlayerWallet(() =>
        localStorage.getItem(PLAYER_WALLET_STORAGE_KEY),
      );
      if (error) {
        setRegisterError(error);
        toast.error(error);
        return null;
      }
      if (token) {
        persistGuestWalletToken(localStorage, token);
        setToken(token);
        setIsGuest(true);
      }
      return token;
    } finally {
      setIsRegistering(false);
    }
  }, [isRegistering]);

  const upgradeGuest = useCallback(async (displayName: string): Promise<boolean> => {
    const guestToken = localStorage.getItem(PLAYER_WALLET_STORAGE_KEY);
    const { token, upgraded } = await upgradeGuestPlayerWallet(
      guestToken,
      isGuest,
      displayName,
    );
    if (!upgraded || !token) return false;
    persistUpgradedWalletToken(localStorage, token);
    setToken(token);
    setIsGuest(false);
    return true;
  }, [isGuest]);

  // Keep isGuest in sync if token changes externally (e.g. claim-guest sets a
  // full-account token).
  useEffect(() => {
    setIsGuest(readGuestFlagFromStorage(localStorage.getItem(PLAYER_GUEST_STORAGE_KEY)));
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
