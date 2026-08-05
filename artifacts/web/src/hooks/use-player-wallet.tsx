import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { registerPlayer, upgradeGuestPlayer } from "@workspace/api-client-react";

export const PLAYER_WALLET_STORAGE_KEY = "streamline.playerWalletToken";
export const PLAYER_GUEST_STORAGE_KEY = "streamline.playerIsGuest";

const GUEST_REGISTER_ERROR = "Не удалось создать гостевой кошелёк";

export function readIsGuestFromStorage(guestFlag: string | null): boolean {
  return guestFlag === "true";
}

export function persistGuestWalletToken(token: string): void {
  localStorage.setItem(PLAYER_WALLET_STORAGE_KEY, token);
  localStorage.setItem(PLAYER_GUEST_STORAGE_KEY, "true");
}

export function persistUpgradedWalletToken(token: string): void {
  localStorage.setItem(PLAYER_WALLET_STORAGE_KEY, token);
  localStorage.removeItem(PLAYER_GUEST_STORAGE_KEY);
}

export type GuestRegisterResult =
  | { ok: true; token: string; cached?: boolean; welcomeBonusLzt?: number }
  | { ok: false; error: string };

export async function registerGuestWallet(
  existingToken: string | null,
  register: typeof registerPlayer = registerPlayer,
): Promise<GuestRegisterResult> {
  if (existingToken) {
    return { ok: true, token: existingToken, cached: true };
  }
  try {
    const data = await register({ guest: true });
    const token = data.playerToken;
    persistGuestWalletToken(token);
    return {
      ok: true,
      token,
      welcomeBonusLzt: data.internalBalanceLzt ?? 0,
    };
  } catch {
    return { ok: false, error: GUEST_REGISTER_ERROR };
  }
}

export async function upgradeGuestWallet(
  guestToken: string | null,
  isGuest: boolean,
  displayName: string,
  upgrade: typeof upgradeGuestPlayer = upgradeGuestPlayer,
): Promise<boolean> {
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
    readIsGuestFromStorage(localStorage.getItem(PLAYER_GUEST_STORAGE_KEY)),
  );
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  const registerGuest = useCallback(async (): Promise<string | null> => {
    if (isRegistering) return null;

    setIsRegistering(true);
    setRegisterError(null);
    try {
      const existing = localStorage.getItem(PLAYER_WALLET_STORAGE_KEY);
      const result = await registerGuestWallet(existing);
      if (!result.ok) {
        setRegisterError(result.error);
        toast.error(result.error);
        return null;
      }
      setToken(result.token);
      if (!result.cached) {
        setIsGuest(true);
        if (result.welcomeBonusLzt && result.welcomeBonusLzt > 0) {
          toast.success(
            `Пробный баланс ${result.welcomeBonusLzt.toLocaleString("ru-RU")} LZT — хватит на первую игру`,
          );
        }
      }
      return result.token;
    } finally {
      setIsRegistering(false);
    }
  }, [isRegistering]);

  const upgradeGuest = useCallback(async (displayName: string): Promise<boolean> => {
    const guestToken = localStorage.getItem(PLAYER_WALLET_STORAGE_KEY);
    const ok = await upgradeGuestWallet(guestToken, isGuest, displayName);
    if (ok) {
      setToken(localStorage.getItem(PLAYER_WALLET_STORAGE_KEY));
      setIsGuest(false);
    }
    return ok;
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
