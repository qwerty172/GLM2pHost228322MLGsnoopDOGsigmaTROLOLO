import { useState } from "react";
import { useLocation } from "wouter";
import { Gamepad2, Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCreateBrowserHostSession } from "@workspace/api-client-react";
import { usePlayerWallet } from "@/hooks/use-player-wallet";
import { formatApiError } from "@/lib/api-errors";

const DEMO_GAME_SLUG = "rogue-fable-3";
const HOST_TOKEN_STORAGE_PREFIX = "streamline.browserHostToken:";
const BROWSER_HOST_URL_STORAGE_PREFIX = "streamline.browserHostUrl:";

type Props = {
  className?: string;
  variant?: "hero" | "inline";
};

/**
 * Один клик — демо Rogue Fable III в браузере (без агента и без установки).
 * Гостевой кошелёк создаётся автоматически при необходимости.
 */
export function InstantDemoPlay({ className = "", variant = "hero" }: Props) {
  const [, navigate] = useLocation();
  const { playerWalletToken, registerGuest, isRegistering } = usePlayerWallet();
  const createBrowserHost = useCreateBrowserHostSession();
  const [busy, setBusy] = useState(false);

  const handlePlay = async () => {
    if (busy || createBrowserHost.isPending) return;
    setBusy(true);
    try {
      let token = playerWalletToken;
      if (!token) {
        token = await registerGuest();
      }
      if (!token) {
        toast.error("Не удалось создать гостевой кошелёк");
        return;
      }
      const res = await createBrowserHost.mutateAsync({
        data: { playerWalletToken: token, gameSlug: DEMO_GAME_SLUG },
      });
      try {
        localStorage.setItem(
          HOST_TOKEN_STORAGE_PREFIX + res.session.id,
          res.hostToken,
        );
        localStorage.setItem(
          BROWSER_HOST_URL_STORAGE_PREFIX + res.session.id,
          res.browserHostUrl,
        );
      } catch {
        /* ignore */
      }
      navigate(`/host/play/${res.session.id}`);
    } catch (err) {
      toast.error(formatApiError(err, "Не удалось запустить демо"));
    } finally {
      setBusy(false);
    }
  };

  const loading =
    busy || createBrowserHost.isPending || isRegistering;

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={() => void handlePlay()}
        disabled={loading}
        className={`text-xs text-teal-400 hover:text-teal-300 underline underline-offset-2 disabled:opacity-50 ${className}`}
        data-testid="button-instant-demo-inline"
      >
        {loading ? "Запуск…" : "Демо в браузере"}
      </button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      disabled={loading}
      onClick={() => void handlePlay()}
      className={`h-9 px-5 text-sm rounded-md border-teal-500/30 text-teal-300 hover:text-white hover:bg-teal-500/10 ${className}`}
      data-testid="button-instant-demo"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
      ) : (
        <Gamepad2 className="w-3.5 h-3.5 mr-1.5" />
      )}
      {loading ? "Запускаем…" : "Демо без установки"}
    </Button>
  );
}
