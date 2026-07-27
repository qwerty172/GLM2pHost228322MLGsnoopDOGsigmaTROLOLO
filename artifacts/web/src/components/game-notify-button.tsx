import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import {
  addGameNotifySubscription,
  GAME_NOTIFY_CHANGED_EVENT,
  isGameNotifySubscribed,
  removeGameNotifySubscription,
  requestNotifyPermission,
} from "@/lib/game-notify";

export function GameNotifyButton({
  slug,
  title,
}: {
  slug: string;
  title: string;
}) {
  const [subscribed, setSubscribed] = useState(() =>
    isGameNotifySubscribed(slug),
  );

  useEffect(() => {
    const refresh = () => setSubscribed(isGameNotifySubscribed(slug));
    window.addEventListener(GAME_NOTIFY_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(GAME_NOTIFY_CHANGED_EVENT, refresh);
  }, [slug]);

  const handleClick = async () => {
    if (subscribed) {
      removeGameNotifySubscription(slug);
      toast.info("Уведомление отключено");
      return;
    }

    const perm = await requestNotifyPermission();
    if (perm === "denied") {
      toast.error("Разреши уведомления в настройках браузера");
      return;
    }

    addGameNotifySubscription({
      slug,
      title,
      subscribedAt: new Date().toISOString(),
    });

    const hint =
      perm === "granted"
        ? "Сообщим push-уведомлением, когда появится хост."
        : "Сообщим в интерфейсе, когда появится хост.";
    toast.success(`Готово! ${hint}`, { duration: 4000 });
  };

  return (
    <button
      type="button"
      className="mt-4 inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors"
      style={{
        background: subscribed ? "rgba(45,212,191,0.08)" : "rgba(255,255,255,0.04)",
        border: subscribed
          ? "1px solid rgba(45,212,191,0.25)"
          : "1px solid rgba(255,255,255,0.08)",
        color: subscribed ? "#5eead4" : "#94a3b8",
      }}
      onClick={() => void handleClick()}
    >
      <Bell className="h-3 w-3" />
      {subscribed ? "Уведомление включено" : "Уведомить когда появится хост"}
    </button>
  );
}
