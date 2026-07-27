import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  useListGames,
  getListGamesQueryKey,
} from "@workspace/api-client-react";
import {
  GAME_NOTIFY_CHANGED_EVENT,
  loadGameNotifySubscriptions,
  removeGameNotifySubscription,
  showGameOnlineNotification,
} from "@/lib/game-notify";

/** Poll catalog every 60s while subscriptions exist; notify when a game gets hosts. */
export function useGameNotifyPoller(): void {
  const [subs, setSubs] = useState(() => loadGameNotifySubscriptions());

  useEffect(() => {
    const refresh = () => setSubs(loadGameNotifySubscriptions());
    window.addEventListener(GAME_NOTIFY_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(GAME_NOTIFY_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const { data: games } = useListGames(
    {},
    {
      query: {
        queryKey: getListGamesQueryKey({}),
        enabled: subs.length > 0,
        refetchInterval: subs.length > 0 ? 60_000 : false,
      },
    },
  );

  useEffect(() => {
    if (!games || subs.length === 0) return;

    const bySlug = new Map(games.map((g) => [g.slug, g]));
    let changed = false;

    for (const sub of subs) {
      const live = bySlug.get(sub.slug);
      if (live && (live.liveHostsCount ?? 0) > 0) {
        removeGameNotifySubscription(sub.slug);
        showGameOnlineNotification(live.title, sub.slug);
        toast.success(`«${live.title}» снова онлайн — можно играть!`, {
          duration: 6000,
        });
        changed = true;
      }
    }

    if (changed) {
      setSubs(loadGameNotifySubscriptions());
    }
  }, [games, subs]);
}
