import { useCallback } from "react";
import { useLocation } from "wouter";
import { useCreateDemoSession } from "@workspace/api-client-react";
import { toast } from "sonner";
import { formatApiError } from "@/lib/api-errors";
import { usePlayerWallet } from "@/hooks/use-player-wallet";

export const DEMO_GAME_SLUG = "rogue-fable-3";

export function useInstantDemo() {
  const [, navigate] = useLocation();
  const { registerGuest } = usePlayerWallet();
  const createDemo = useCreateDemoSession();

  const launchDemo = useCallback(
    async (gameSlug = DEMO_GAME_SLUG) => {
      try {
        await registerGuest();
        const res = await createDemo.mutateAsync({
          data: gameSlug === DEMO_GAME_SLUG ? {} : { gameSlug },
        });
        const inviteCode = res.session.inviteCode;
        if (inviteCode) {
          navigate(`/play/i/${inviteCode}`);
          return;
        }
        if (res.session.playerToken) {
          navigate(`/play/${res.session.playerToken}`);
          return;
        }
        toast.error("Не удалось открыть демо — нет ссылки на сессию");
      } catch (err) {
        toast.error(formatApiError(err, "Не удалось запустить демо"));
      }
    },
    [createDemo, navigate, registerGuest],
  );

  return {
    launchDemo,
    isLaunching: createDemo.isPending,
  };
}
