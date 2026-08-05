import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { registerPlayer, upgradeGuestPlayer } from "@workspace/api-client-react";

export const PLAYER_WALLET_STORAGE_KEY = "streamline.playerWalletToken";
export const PLAYER_IS_GUEST_STORAGE_KEY = "streamline.playerIsGuest";

interface PlayerWalletState {
  playerWalletToken: string | null;
  isGuest: boolean;
  isRegistering: boolean;
  registerError: string | null;
  registerGuest: () => Promise<string | null>;
  upgradeGuest: (displayName: string) => Promise<boolean>;
}

export function readGuestFlagFromStorage(): boolean {
  return localStorage.getItem(PLAYER_IS_GUEST_STORAGE_KEY) === "true";
}

export function persistGuestWalletToken(token: string): void {
  localStorage.setItem(PLAYER_WALLET_STORAGE_KEY, token);
  localStorage.setItem(PLAYER_IS_GUEST_STORAGE_KEY, "true");
}

export function persistUpgradedWalletToken(token: string): void {
  localStorage.setItem(PLAYER_WALLET_STORAGE_KEY, token);
  localStorage.removeItem(PLAYER_IS_GUEST_STORAGE_KEY);
}

export async function registerGuestWalletAsync(
  register: typeof registerPlayer = registerPlayer,
  options: { isRegistering: boolean; existingToken: string | null },
): Promise<{ token: string | null; error: string | null }> {
  if (options.isRegistering) return { token: null, error: null };
  if (options.existingToken) return { token: options.existingToken, error: null };

  try {
    const data = await register({ guest: true });
    persistGuestWalletToken(data.playerToken);
    return { token: data.playerToken, error: null };
  } catch {
    return { token: null, error: "Не удалось создать гостевой кошелёк" };
  }
}

export async function upgradeGuestWalletAsync(
  upgrade: typeof upgradeGuestPlayer = upgradeGuestPlayer,
  options: { guestToken: string | null; isGuest: boolean; displayName: string },
): Promise<boolean> {
  const { guestToken, isGuest, displayName } = options;
  if (!guestToken || !isGuest) return false;

  try {
    const data = await upgrade({
      guestToken,
      displayName: displayName.trim(),
    });
    persistUpgradedWalletToken(data.playerToken);
    return true;
  } catch {
    return false;
  }
}

export function usePlayerWallet(): PlayerWalletState {
  const [playerWalletToken, setToken] = useState<string | null>(() =>
    localStorage.getItem(PLAYER_WALLET_STORAGE_KEY),
  );
  const [isGuest, setIsGuest] = useState<boolean>(() => readGuestFlagFromStorage());
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  const registerGuest = useCallback(async (): Promise<string | null> => {
    if (isRegistering) return null;
    const existing = localStorage.getItem(PLAYER_WALLET_STORAGE_KEY);
    if (existing) return existing;

    setIsRegistering(true);
    setRegisterError(null);
    try {
      const result = await registerGuestWalletAsync(registerPlayer, {
        isRegistering: false,
        existingToken: null,
      });
      if (result.error) {
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
    const guestToken = localStorage.getItem(PLAYER_WALLET_STORAGE_KEY);
    const ok = await upgradeGuestWalletAsync(upgradeGuestPlayer, {
      guestToken,
      isGuest,
      displayName,
    });
    if (ok) {
      setToken(localStorage.getItem(PLAYER_WALLET_STORAGE_KEY));
      setIsGuest(false);
    }
    return ok;
  }, [isGuest]);

  // Keep isGuest in sync if token changes externally (e.g. claim-guest sets a
  // full-account token).
  useEffect(() => {
    setIsGuest(readGuestFlagFromStorage());
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
