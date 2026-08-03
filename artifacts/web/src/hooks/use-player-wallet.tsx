import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { registerPlayer, upgradeGuestPlayer } from "@workspace/api-client-react";

const STORAGE_KEY = "streamline.playerWalletToken";
const GUEST_KEY = "streamline.playerIsGuest";

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
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;

    setIsRegistering(true);
    setRegisterError(null);
    try {
      const data = await registerPlayer({ guest: true });
      const token = data.playerToken;
      localStorage.setItem(STORAGE_KEY, token);
      localStorage.setItem(GUEST_KEY, "true");
      setToken(token);
      setIsGuest(true);
      return token;
    } catch {
      const msg = "Не удалось создать гостевой кошелёк";
      setRegisterError(msg);
      toast.error(msg);
      return null;
    } finally {
      setIsRegistering(false);
    }
  }, [isRegistering]);

  const upgradeGuest = useCallback(async (displayName: string): Promise<boolean> => {
    const guestToken = localStorage.getItem(STORAGE_KEY);
    if (!guestToken || !isGuest) return false;
    try {
      const data = await upgradeGuestPlayer({
        guestToken,
        displayName: displayName.trim(),
      });
      localStorage.setItem(STORAGE_KEY, data.playerToken);
      localStorage.removeItem(GUEST_KEY);
      setToken(data.playerToken);
      setIsGuest(false);
      return true;
    } catch {
      return false;
    }
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

/** Silently creates a guest wallet on mount when none exists — no toast on success. */
export function useEnsurePlayerWallet(): void {
  const { playerWalletToken, registerGuest } = usePlayerWallet();

  useEffect(() => {
    if (!playerWalletToken) {
      void registerGuest();
    }
  }, [playerWalletToken, registerGuest]);
}
