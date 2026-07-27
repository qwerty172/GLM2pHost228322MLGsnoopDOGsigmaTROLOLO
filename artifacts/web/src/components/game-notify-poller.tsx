import { useGameNotifyPoller } from "@/hooks/use-game-notify-poller";

/** Invisible poller — mount once inside QueryClientProvider. */
export function GameNotifyPoller() {
  useGameNotifyPoller();
  return null;
}
