import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, Gamepad2, Wallet, Rocket, CheckCircle2 } from "lucide-react";
import { useCreateBrowserHostSession } from "@workspace/api-client-react";
import { usePlayerWallet } from "@/hooks/use-player-wallet";
import { formatApiError } from "@/lib/api-errors";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

const DEMO_GAME_SLUG = "rogue-fable-3";
const HOST_TOKEN_STORAGE_PREFIX = "streamline.browserHostToken:";
const BROWSER_HOST_URL_STORAGE_PREFIX = "streamline.browserHostUrl:";

type Step = "wallet" | "session" | "done" | "error";

const STEPS: { key: Step; label: string; icon: ReactNode }[] = [
  { key: "wallet", label: "Гостевой кошелёк", icon: <Wallet className="w-4 h-4" /> },
  { key: "session", label: "Запуск демо-игры", icon: <Rocket className="w-4 h-4" /> },
  { key: "done", label: "Готово", icon: <CheckCircle2 className="w-4 h-4" /> },
];

function stepIndex(step: Step): number {
  if (step === "error") return -1;
  return STEPS.findIndex((s) => s.key === step);
}

export default function TryPage() {
  const [, navigate] = useLocation();
  const { registerGuest } = usePlayerWallet();
  const createBrowserHost = useCreateBrowserHostSession();
  const startedRef = useRef(false);

  const [step, setStep] = useState<Step>("wallet");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const run = async () => {
      try {
        setStep("wallet");
        const token = await registerGuest();
        if (!token) {
          setError("Не удалось создать гостевой кошелёк");
          setStep("error");
          return;
        }

        setStep("session");
        const res = await createBrowserHost.mutateAsync({
          data: { playerWalletToken: token, gameSlug: DEMO_GAME_SLUG },
        });

        try {
          localStorage.setItem(HOST_TOKEN_STORAGE_PREFIX + res.session.id, res.hostToken);
          localStorage.setItem(BROWSER_HOST_URL_STORAGE_PREFIX + res.session.id, res.browserHostUrl);
        } catch {
          /* ignore */
        }

        setStep("done");
        navigate(`/host/play/${res.session.id}`);
      } catch (err) {
        setError(formatApiError(err, "Не удалось запустить демо"));
        setStep("error");
      }
    };

    void run();
  }, [registerGuest, createBrowserHost, navigate]);

  const currentIdx = stepIndex(step);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-slate-300"
      style={{ background: "#06090e" }}
    >
      <div
        className="w-full max-w-md rounded-xl p-8"
        style={{ background: "#0a1018", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(14,165,233,0.12)" }}
          >
            <Gamepad2 className="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Быстрый старт</h1>
            <p className="text-xs text-slate-500">Rogue Fable III · без установки агента</p>
          </div>
        </div>

        {step !== "error" ? (
          <ul className="space-y-3 mb-6">
            {STEPS.map((s, i) => {
              const done = currentIdx > i;
              const active = currentIdx === i;
              return (
                <li key={s.key} className="flex items-center gap-3 text-sm">
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      background: done
                        ? "rgba(16,185,129,0.15)"
                        : active
                          ? "rgba(14,165,233,0.15)"
                          : "rgba(255,255,255,0.04)",
                      color: done ? "#34d399" : active ? "#38bdf8" : "#64748b",
                    }}
                  >
                    {done ? <CheckCircle2 className="w-4 h-4" /> : active ? <Loader2 className="w-4 h-4 animate-spin" /> : s.icon}
                  </span>
                  <span style={{ color: done || active ? "#e2e8f0" : "#64748b" }}>
                    {s.label}
                    {active && s.key !== "done" && "…"}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-red-400 mb-6">{error}</p>
        )}

        {step === "error" && (
          <div className="flex flex-col gap-2">
            <Button
              className="w-full"
              style={{ background: "#0ea5e9" }}
              onClick={() => {
                startedRef.current = false;
                setError(null);
                setStep("wallet");
                window.location.reload();
              }}
            >
              Попробовать снова
            </Button>
            <Link href="/games">
              <Button variant="ghost" className="w-full text-slate-400">
                Перейти в каталог
              </Button>
            </Link>
          </div>
        )}

        {step !== "error" && (
          <p className="text-xs text-slate-600 text-center">
            Агент Windows не нужен — игра запускается прямо в браузере
          </p>
        )}
      </div>
    </div>
  );
}
