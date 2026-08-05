import { useAuth } from "@/hooks/use-auth";
import { getHost, useRegisterHost } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Loader2, Cpu, Zap, CircleDollarSign } from "lucide-react";
import { toast } from "sonner";
import { SiteNav } from "@/components/site-nav";

export const HOST_AUTH_FEATURES = [
  { title: "P2P стриминг", text: "WebRTC напрямую" },
  { title: "Крипто-выплаты", text: "95% дохода тебе" },
  { title: "Агент хоста", text: "Простая установка" },
] as const;

export const HOST_AUTH_REGISTER_TOAST = {
  clipboardOk: "Узел создан — токен скопирован",
  clipboardFail: "Узел зарегистрирован!",
  error: "Не удалось зарегистрировать хост",
} as const;

export const HOST_AUTH_EXISTING_TOKEN_TOAST = {
  success: (displayName: string) => `Вход выполнен: ${displayName}`,
  error: "Токен не найден. Проверьте правильность и попробуйте снова.",
} as const;

export function isHostDisplayNameValid(displayName: string): boolean {
  return displayName.trim().length > 0;
}

export function isExistingHostTokenValid(token: string): boolean {
  return token.trim().length > 0;
}

export async function validateExistingHostToken(
  token: string,
  lookup: typeof getHost = getHost,
): Promise<{ ok: true; displayName: string } | { ok: false }> {
  const trimmed = token.trim();
  if (!isExistingHostTokenValid(trimmed)) return { ok: false };
  try {
    const host = await lookup(trimmed);
    return { ok: true, displayName: host.displayName };
  } catch {
    return { ok: false };
  }
}

const HOST_AUTH_FEATURE_ICONS = [Zap, CircleDollarSign, Cpu] as const;

export function HostAuthGuard({ children }: { children: React.ReactNode }) {
  const { hostToken, setHostToken } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [existingToken, setExistingToken] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);

  const registerHost = useRegisterHost();

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isHostDisplayNameValid(displayName)) return;

    registerHost.mutate(
      { data: { displayName } },
      {
        onSuccess: (data) => {
          setHostToken(data.hostToken);
          void navigator.clipboard.writeText(data.hostToken).then(
            () => toast.success(HOST_AUTH_REGISTER_TOAST.clipboardOk),
            () => toast.success(HOST_AUTH_REGISTER_TOAST.clipboardFail),
          );
        },
        onError: () => {
          toast.error(HOST_AUTH_REGISTER_TOAST.error);
        },
      },
    );
  };

  const handleExistingToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isExistingHostTokenValid(existingToken) || isSigningIn) return;

    setIsSigningIn(true);
    try {
      const result = await validateExistingHostToken(existingToken);
      if (!result.ok) {
        toast.error(HOST_AUTH_EXISTING_TOKEN_TOAST.error);
        return;
      }
      setHostToken(existingToken.trim());
      toast.success(HOST_AUTH_EXISTING_TOKEN_TOAST.success(result.displayName));
    } finally {
      setIsSigningIn(false);
    }
  };

  if (hostToken) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#06090e" }}>
      <SiteNav activePath="/host" />

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
            {HOST_AUTH_FEATURES.map((f, i) => {
              const Icon = HOST_AUTH_FEATURE_ICONS[i];
              const iconClass =
                i === 1 ? "w-4 h-4 text-teal-400" : "w-4 h-4 text-sky-400";
              return (
              <div
                key={f.title}
                className="p-3 rounded-xl text-center"
                style={{ background: "#0a1018", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="flex justify-center mb-1.5">
                  <Icon className={iconClass} />
                </div>
                <div className="text-[11px] font-semibold text-white mb-0.5">{f.title}</div>
                <div className="text-[10px] text-slate-500">{f.text}</div>
              </div>
            );
            })}
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
                disabled={registerHost.isPending || !isHostDisplayNameValid(displayName)}
              >
                {registerHost.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {registerHost.isPending ? "Регистрируем…" : "Создать узел"}
              </Button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }} />
              </div>
              <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
                <span className="px-3 text-slate-600" style={{ background: "#0a1018" }}>
                  или
                </span>
              </div>
            </div>

            <h2 className="text-base font-semibold text-white mb-4">
              У меня уже есть токен
            </h2>
            <form onSubmit={handleExistingToken} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="existingHostToken" className="text-slate-400 text-xs">
                  Токен хоста
                </Label>
                <Input
                  id="existingHostToken"
                  placeholder="Вставьте токен из ZIP или дашборда"
                  value={existingToken}
                  onChange={(e) => setExistingToken(e.target.value)}
                  className="h-10 text-sm font-mono"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#e2e8f0",
                  }}
                  autoComplete="off"
                  spellCheck={false}
                />
                <p className="text-[11px] text-slate-600">
                  Токен сохранится в браузере — при следующем визите вход будет автоматическим
                </p>
              </div>
              <Button
                type="submit"
                variant="outline"
                className="w-full h-10 font-bold text-sm border-white/10 hover:border-sky-500/40 text-slate-300 hover:text-white"
                disabled={isSigningIn || !isExistingHostTokenValid(existingToken)}
              >
                {isSigningIn ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {isSigningIn ? "Проверяем…" : "Войти"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
