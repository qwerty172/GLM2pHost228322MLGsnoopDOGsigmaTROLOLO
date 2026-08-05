import { useAuth } from "@/hooks/use-auth";
import { useRegisterHost, type Host } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Loader2, Cpu, Zap, CircleDollarSign } from "lucide-react";
import { toast } from "sonner";
import { SiteNav } from "@/components/site-nav";
import {
  HOST_AUTH_ACTIVE_PATH,
  HOST_REGISTER_FEATURES,
  buildHostRegisterRequest,
  canSubmitHostRegistration,
  persistHostTokenClipboard,
} from "@/lib/host-auth-guard";

const FEATURE_ICONS = [
  <Zap className="w-4 h-4 text-sky-400" key="zap" />,
  <CircleDollarSign className="w-4 h-4 text-teal-400" key="coin" />,
  <Cpu className="w-4 h-4 text-sky-400" key="cpu" />,
];

export function HostAuthGuard({ children }: { children: React.ReactNode }) {
  const { hostToken, setHostToken } = useAuth();
  const [displayName, setDisplayName] = useState("");

  const registerHost = useRegisterHost();

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = buildHostRegisterRequest(displayName);
    if (!payload) return;

    registerHost.mutate(payload, {
        onSuccess: (data: Host) => {
          setHostToken(data.hostToken);
          void persistHostTokenClipboard(data.hostToken, (text) =>
            navigator.clipboard.writeText(text),
          ).then((result) => {
            toast.success(
              result === "copied" ? "Узел создан — токен скопирован" : "Узел зарегистрирован!",
            );
          });
        },
        onError: () => {
          toast.error("Не удалось зарегистрировать хост");
        },
      },
    );
  };

  if (hostToken) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#06090e" }}>
      <SiteNav activePath={HOST_AUTH_ACTIVE_PATH} />

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: "linear-gradient(135deg,#0ea5e9,#14b8a6)" }}
            >
              <Cpu className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight mb-2">
              Стать хостом
            </h1>
            <p className="text-sm text-slate-400 max-w-sm mx-auto">
              Сдавай свой ПК в аренду пока не играешь — зарабатывай крипту за каждую минуту сессии.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-8">
            {HOST_REGISTER_FEATURES.map((f, i) => (
              <div
                key={f.title}
                className="p-3 rounded-xl text-center"
                style={{ background: "#0a1018", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="flex justify-center mb-1.5">{FEATURE_ICONS[i]}</div>
                <div className="text-[11px] font-semibold text-white mb-0.5">{f.title}</div>
                <div className="text-[10px] text-slate-500">{f.text}</div>
              </div>
            ))}
          </div>

          <div
            className="rounded-2xl p-6"
            style={{ background: "#0a1018", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <h2 className="text-base font-semibold text-white mb-4">
              Зарегистрировать узел
            </h2>
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="displayName" className="text-slate-400 text-xs">
                  Отображаемое имя
                </Label>
                <Input
                  id="displayName"
                  placeholder="Например: RTX_4090_Beast"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="h-10 text-sm"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#e2e8f0",
                  }}
                  autoFocus
                />
                <p className="text-[11px] text-slate-600">
                  Под этим именем тебя увидят игроки в каталоге хостов
                </p>
              </div>
              <Button
                type="submit"
                className="w-full h-10 font-bold text-sm"
                style={{ background: "#0ea5e9", color: "#fff" }}
                disabled={!canSubmitHostRegistration(displayName, registerHost.isPending)}
              >
                {registerHost.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {registerHost.isPending ? "Регистрируем…" : "Создать узел"}
              </Button>
            </form>
          </div>

          <p className="text-center text-[11px] text-slate-600 mt-4">
            Уже есть токен? Он сохраняется автоматически в браузере.
          </p>
        </div>
      </div>
    </div>
  );
}
