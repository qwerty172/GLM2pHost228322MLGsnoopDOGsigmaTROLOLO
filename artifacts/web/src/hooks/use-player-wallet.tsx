import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const STORAGE_KEY = "streamline.playerWalletToken";
const GUEST_KEY = "streamline.playerIsGuest";
const BASE = (import.meta.env.BASE_URL as string).replace(/\/$/, "");

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
      const res = await fetch(`${BASE}/api/players/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guest: true }),
      });
      if (!res.ok) {
        const msg = "Не удалось создать гостевой кошелёк";
        setRegisterError(msg);
        toast.error(msg);
        return null;
      }
      const data = await res.json();
      const token: string = data.playerToken;
      localStorage.setItem(STORAGE_KEY, token);
      localStorage.setItem(GUEST_KEY, "true");
      setToken(token);
      setIsGuest(true);
      return token;
    } catch {
      const msg = "Нет соединения с сервером — гостевой кошелёк не создан";
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
      const res = await fetch(`${BASE}/api/players/upgrade-guest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestToken, displayName: displayName.trim() }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      const token: string = data.playerToken;
      localStorage.setItem(STORAGE_KEY, token);
      localStorage.removeItem(GUEST_KEY);
      setToken(token);
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
