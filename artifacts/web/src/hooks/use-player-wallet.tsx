import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { registerPlayer, upgradeGuestPlayer } from "@workspace/api-client-react";

const STORAGE_KEY = "streamline.playerWalletToken";
const GUEST_KEY = "streamline.playerIsGuest";

export const PLAYER_WALLET_TOKEN_KEY = STORAGE_KEY;
export const PLAYER_IS_GUEST_KEY = GUEST_KEY;

export function readPlayerIsGuestFromStorage(): boolean {
  return localStorage.getItem(GUEST_KEY) === "true";
}

export async function registerGuestPlayerWallet(
  register: typeof registerPlayer = registerPlayer,
  existingToken: string | null = localStorage.getItem(STORAGE_KEY),
): Promise<{ token: string | null; error: string | null }> {
  if (existingToken) return { token: existingToken, error: null };
  try {
    const data = await register({ guest: true });
    const token = data.playerToken;
    localStorage.setItem(STORAGE_KEY, token);
    localStorage.setItem(GUEST_KEY, "true");
    return { token, error: null };
  } catch {
    return { token: null, error: "Не удалось создать гостевой кошелёк" };
  }
}

export async function upgradeGuestPlayerWallet(
  displayName: string,
  guestToken: string | null = localStorage.getItem(STORAGE_KEY),
  isGuest: boolean = readPlayerIsGuestFromStorage(),
  upgrade: typeof upgradeGuestPlayer = upgradeGuestPlayer,
): Promise<{ token: string | null; success: boolean }> {
  if (!guestToken || !isGuest) return { token: null, success: false };
  try {
    const data = await upgrade({
      guestToken,
      displayName: displayName.trim(),
    });
    localStorage.setItem(STORAGE_KEY, data.playerToken);
    localStorage.removeItem(GUEST_KEY);
    return { token: data.playerToken, success: true };
  } catch {
    return { token: null, success: false };
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
    localStorage.getItem(GUEST_KEY) === "true",
  );
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  const registerGuest = useCallback(async (): Promise<string | null> => {
    if (isRegistering) return null;

    setIsRegistering(true);
    setRegisterError(null);
    try {
      const { token, error } = await registerGuestPlayerWallet();
      if (error) {
        setRegisterError(error);
        toast.error(error);
        return null;
      }
      if (token) {
        setToken(token);
        setIsGuest(true);
      }
      return token;
    } finally {
      setIsRegistering(false);
    }
  }, [isRegistering]);

  const upgradeGuest = useCallback(async (displayName: string): Promise<boolean> => {
    const guestToken = localStorage.getItem(STORAGE_KEY);
    const { token, success } = await upgradeGuestPlayerWallet(displayName, guestToken, isGuest);
    if (success && token) {
      setToken(token);
      setIsGuest(false);
    }
    return success;
  }, [isGuest]);

  // Keep isGuest in sync if token changes externally (e.g. claim-guest sets a
  // full-account token).
  useEffect(() => {
    const stored = localStorage.getItem(GUEST_KEY);
    setIsGuest(stored === "true");
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
