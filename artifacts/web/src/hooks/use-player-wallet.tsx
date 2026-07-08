import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "streamline.playerWalletToken";
const GUEST_KEY = "streamline.playerIsGuest";
const BASE = (import.meta.env.BASE_URL as string).replace(/\/$/, "");

interface PlayerWalletState {
  playerWalletToken: string | null;
  isGuest: boolean;
  isRegistering: boolean;
  registerGuest: () => Promise<string | null>;
}

export function usePlayerWallet(): PlayerWalletState {
  const [playerWalletToken, setToken] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEY),
  );
  const [isGuest, setIsGuest] = useState<boolean>(() =>
    localStorage.getItem(GUEST_KEY) === "true",
  );
  const [isRegistering, setIsRegistering] = useState(false);

  const registerGuest = useCallback(async (): Promise<string | null> => {
    if (isRegistering) return null;
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;

    setIsRegistering(true);
    try {
      const res = await fetch(`${BASE}/api/players/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guest: true }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const token: string = data.playerToken;
      localStorage.setItem(STORAGE_KEY, token);
      localStorage.setItem(GUEST_KEY, "true");
      setToken(token);
      setIsGuest(true);
      return token;
    } catch {
      return null;
    } finally {
      setIsRegistering(false);
    }
  }, [isRegistering]);

  // Keep isGuest in sync if token changes externally (e.g. claim-guest sets a
  // full-account token).
  useEffect(() => {
    const stored = localStorage.getItem(GUEST_KEY);
    setIsGuest(stored === "true");
  }, [playerWalletToken]);

  return { playerWalletToken, isGuest, isRegistering, registerGuest };
}
