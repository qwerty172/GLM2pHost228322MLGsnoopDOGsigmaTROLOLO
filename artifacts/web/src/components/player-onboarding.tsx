import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Gamepad2, Monitor, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export const PLAYER_ONBOARDING_STORAGE_KEY = "streamline.playerOnboardingDone";

const STEPS = [
  {
    icon: Gamepad2,
    title: "Выбери игру",
    body: "В каталоге — обложки, цена за минуту и сколько хостов в онлайне.",
  },
  {
    icon: Users,
    title: "Выбери хоста",
    body: "На странице игры — список живых ПК с пингом и тарифом. Жми «Играть».",
  },
  {
    icon: Monitor,
    title: "Играй в браузере",
    body: "Стрим с хоста, управление с клавиатуры и мыши. Оплата — только за минуты в игре.",
  },
] as const;

function isOnboardingDone(): boolean {
  try {
    return localStorage.getItem(PLAYER_ONBOARDING_STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

function markOnboardingDone(): void {
  try {
    localStorage.setItem(PLAYER_ONBOARDING_STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** Короткий оверлей для новичков — один раз, localStorage-флаг. */
export function PlayerOnboardingOverlay() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!isOnboardingDone()) setOpen(true);
  }, []);

  if (!open) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  const close = () => {
    markOnboardingDone();
    setOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      data-testid="player-onboarding-overlay"
    >
      <div
        className="relative w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{
          background: "#0a1018",
          border: "1px solid rgba(14,165,233,0.25)",
        }}
      >
        <button
          type="button"
          onClick={close}
          className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors"
          aria-label="Закрыть"
          data-testid="player-onboarding-close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(14,165,233,0.15)" }}
          >
            <Icon className="h-6 w-6 text-sky-400" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
              Шаг {step + 1} из {STEPS.length}
            </p>
            <h2 className="text-lg font-bold text-white">{current.title}</h2>
          </div>
        </div>

        <p className="text-sm text-slate-400 leading-relaxed mb-6">{current.body}</p>

        <div className="flex gap-1.5 mb-6">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className="h-1 flex-1 rounded-full transition-colors"
              style={{
                background:
                  i <= step ? "rgba(14,165,233,0.7)" : "rgba(255,255,255,0.08)",
              }}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={close}
            className="text-xs text-slate-500 hover:text-slate-400 transition-colors"
            data-testid="player-onboarding-skip"
          >
            Пропустить
          </button>
          {isLast ? (
            <Link href="/games">
              <Button
                size="sm"
                className="font-semibold"
                style={{ background: "#0ea5e9", color: "#fff" }}
                onClick={close}
                data-testid="player-onboarding-finish"
              >
                В каталог
              </Button>
            </Link>
          ) : (
            <Button
              size="sm"
              className="font-semibold"
              style={{ background: "#0ea5e9", color: "#fff" }}
              onClick={() => setStep((s) => s + 1)}
              data-testid="player-onboarding-next"
            >
              Далее
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
