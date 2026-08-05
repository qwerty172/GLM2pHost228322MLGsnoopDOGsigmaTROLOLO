import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Gamepad2, Play, Rocket, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInstantDemo } from "@/hooks/use-instant-demo";

export const PLAYER_ONBOARDING_STORAGE_KEY = "streamline.playerOnboardingDismissed";

const STEPS = [
  {
    icon: Gamepad2,
    title: "Выбери игру",
    text: "Каталог показывает цену за минуту и сколько хостов онлайн.",
  },
  {
    icon: Play,
    title: "Подключись в один клик",
    text: "Нажми «Играть» у живого хоста или «Попробовать демо» — без регистрации.",
  },
  {
    icon: Rocket,
    title: "Играй в браузере",
    text: "Геймпад и клавиатура работают сразу. Платишь только за фактические минуты.",
  },
] as const;

export function PlayerFirstRun({ onDismiss }: { onDismiss?: () => void }) {
  const [open, setOpen] = useState(false);
  const { launchDemo, isLaunching } = useInstantDemo();

  useEffect(() => {
    try {
      if (localStorage.getItem(PLAYER_ONBOARDING_STORAGE_KEY) !== "true") {
        setOpen(true);
      }
    } catch {
      setOpen(true);
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(PLAYER_ONBOARDING_STORAGE_KEY, "true");
    } catch {
      /* ignore */
    }
    setOpen(false);
    onDismiss?.();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(6,9,14,0.82)" }}
      data-testid="player-first-run"
    >
      <div
        className="w-full max-w-md rounded-xl p-5 shadow-2xl"
        style={{
          background: "#0a1018",
          border: "1px solid rgba(14,165,233,0.25)",
        }}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-sky-400 mb-1">
              Быстрый старт
            </p>
            <h2 className="text-lg font-bold text-white">Как играть за 30 секунд</h2>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="text-slate-500 hover:text-slate-300 transition-colors"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <ol className="space-y-3 mb-5">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex items-start gap-3">
              <span
                className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  background: "rgba(14,165,233,0.12)",
                  color: "#38bdf8",
                }}
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white flex items-center gap-1.5">
                  <step.icon className="h-3.5 w-3.5 text-sky-400" />
                  {step.title}
                </p>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            className="flex-1 h-9 text-sm font-semibold"
            style={{ background: "#0ea5e9", color: "#fff" }}
            disabled={isLaunching}
            onClick={() => {
              dismiss();
              void launchDemo();
            }}
            data-testid="button-first-run-demo"
          >
            <Play className="h-3.5 w-3.5 mr-1.5" />
            {isLaunching ? "Запуск…" : "Попробовать демо"}
          </Button>
          <Link href="/games" onClick={dismiss}>
            <Button
              variant="outline"
              className="w-full sm:w-auto h-9 text-sm border-white/10 text-slate-300"
              data-testid="button-first-run-catalog"
            >
              К каталогу
            </Button>
          </Link>
        </div>

        <button
          type="button"
          onClick={dismiss}
          className="w-full mt-3 text-[11px] text-slate-600 hover:text-slate-400 transition-colors"
        >
          Понятно, больше не показывать
        </button>
      </div>
    </div>
  );
}
