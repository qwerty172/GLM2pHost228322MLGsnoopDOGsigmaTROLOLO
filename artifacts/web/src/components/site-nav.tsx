import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Coins, Cpu, Gamepad2, MonitorPlay, UserCircle2 } from "lucide-react";

type NavKey =
  | "/"
  | "/games"
  | "/hosts"
  | "/quotas"
  | "/host"
  | "/wallet";

interface Props {
  activePath?: NavKey | string;
}

export function SiteNav({ activePath }: Props) {
  return (
    <nav
      className="sticky top-0 z-50 border-b"
      style={{
        background: "rgba(6,11,16,0.92)",
        backdropFilter: "blur(10px)",
        borderColor: "rgba(255,255,255,0.06)",
      }}
    >
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-8">
        <Link href="/">
          <div className="flex items-center gap-2 shrink-0 cursor-pointer">
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#0ea5e9,#14b8a6)" }}
            >
              <MonitorPlay className="w-4 h-4 text-white" />
            </div>
            <span className="text-[15px] font-bold text-white tracking-tight">
              DecentralHub
            </span>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-6">
          <Link href="/games">
            <span
              className="flex items-center gap-1.5 text-[13px] font-medium transition-colors cursor-pointer"
              style={{
                color: activePath === "/games" ? "#38bdf8" : "#94a3b8",
              }}
              data-testid="link-nav-games"
            >
              <Gamepad2 className="w-3.5 h-3.5" /> Игры
            </span>
          </Link>
          <Link href="/hosts">
            <span
              className="flex items-center gap-1.5 text-[13px] font-medium transition-colors cursor-pointer"
              style={{
                color: activePath === "/hosts" ? "#38bdf8" : "#94a3b8",
              }}
              data-testid="link-nav-hosts"
            >
              <Cpu className="w-3.5 h-3.5" /> Хосты
            </span>
          </Link>
          <Link href="/quotas">
            <span
              className="flex items-center gap-1.5 text-[13px] font-medium transition-colors cursor-pointer"
              style={{
                color: activePath === "/quotas" ? "#38bdf8" : "#94a3b8",
              }}
              data-testid="link-nav-quotas"
            >
              <Coins className="w-3.5 h-3.5" /> Квоты
            </span>
          </Link>
          {(["Биржа", "Форум", "Кредиты"] as const).map((label) => (
            <span
              key={label}
              className="flex items-center gap-1.5 text-[13px] font-medium opacity-45 cursor-not-allowed select-none"
              style={{ color: "#94a3b8" }}
            >
              {label}
              <span
                className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded"
                style={{
                  background: "rgba(14,165,233,0.08)",
                  color: "#38bdf8",
                  border: "1px solid rgba(14,165,233,0.2)",
                }}
              >
                скоро
              </span>
            </span>
          ))}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 inline-block" />
            онлайн
          </div>
          <Link href="/host">
            <Button
              size="sm"
              className="h-8 px-4 text-xs font-semibold rounded-md"
              style={{
                background:
                  activePath === "/host" || activePath === "/wallet"
                    ? "#0ea5e9"
                    : "rgba(14,165,233,0.12)",
                color:
                  activePath === "/host" || activePath === "/wallet"
                    ? "#fff"
                    : "#38bdf8",
                border: "1px solid rgba(14,165,233,0.25)",
              }}
              data-testid="button-nav-host"
            >
              <UserCircle2 className="w-3.5 h-3.5 mr-1.5" /> Кабинет
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}
