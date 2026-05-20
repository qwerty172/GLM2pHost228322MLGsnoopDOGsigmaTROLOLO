import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  ArrowLeftRight,
  Coins,
  Cpu,
  Gamepad2,
  MonitorPlay,
  UserCircle2,
  Zap,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useGetWallet, getGetWalletQueryKey } from "@workspace/api-client-react";

type NavKey =
  | "/"
  | "/games"
  | "/hosts"
  | "/quotas"
  | "/host"
  | "/wallet"
  | "/exchange"
  | "/profile";

interface Props {
  activePath?: NavKey | string;
}

function BalanceChip({ hostToken }: { hostToken: string }) {
  const { data: wallet } = useGetWallet(hostToken, {
    query: { retry: false, staleTime: 30_000, queryKey: getGetWalletQueryKey(hostToken) },
  });

  const blueLzt = wallet?.internalBalanceLzt ?? null;

  if (blueLzt === null) return null;

  return (
    <div
      className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-md text-[12px] font-semibold"
      style={{
        background: "rgba(14,165,233,0.1)",
        border: "1px solid rgba(14,165,233,0.2)",
        color: "#38bdf8",
      }}
      data-testid="balance-chip"
    >
      <Zap className="w-3 h-3" />
      {new Intl.NumberFormat("ru-RU").format(Math.trunc(blueLzt))} LZT
    </div>
  );
}

export function SiteNav({ activePath }: Props) {
  const { hostToken } = useAuth();

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

        <div className="hidden md:flex items-center gap-1">
          {/* Player branch */}
          <Link href="/games">
            <span
              className="flex items-center gap-1.5 text-[13px] font-medium transition-colors cursor-pointer px-3 py-1.5 rounded-md"
              style={{
                color: activePath === "/games" ? "#38bdf8" : "#94a3b8",
                background:
                  activePath === "/games"
                    ? "rgba(14,165,233,0.08)"
                    : "transparent",
              }}
              data-testid="link-nav-games"
            >
              <Gamepad2 className="w-3.5 h-3.5" /> Играть
            </span>
          </Link>
          <Link href="/profile">
            <span
              className="flex items-center gap-1.5 text-[13px] font-medium transition-colors cursor-pointer px-3 py-1.5 rounded-md"
              style={{
                color: activePath === "/profile" ? "#38bdf8" : "#94a3b8",
                background:
                  activePath === "/profile"
                    ? "rgba(14,165,233,0.08)"
                    : "transparent",
              }}
              data-testid="link-nav-profile"
            >
              <UserCircle2 className="w-3.5 h-3.5" /> Профиль
            </span>
          </Link>

          <div
            className="mx-2 h-4 w-px shrink-0"
            style={{ background: "rgba(255,255,255,0.1)" }}
          />

          {/* Host branch */}
          <Link href="/host">
            <span
              className="flex items-center gap-1.5 text-[13px] font-medium transition-colors cursor-pointer px-3 py-1.5 rounded-md"
              style={{
                color:
                  activePath === "/host" || activePath === "/wallet"
                    ? "#38bdf8"
                    : "#94a3b8",
                background:
                  activePath === "/host" || activePath === "/wallet"
                    ? "rgba(14,165,233,0.08)"
                    : "transparent",
              }}
              data-testid="link-nav-host-panel"
            >
              <Cpu className="w-3.5 h-3.5" /> Хостить
            </span>
          </Link>
          <Link href="/quotas">
            <span
              className="flex items-center gap-1.5 text-[13px] font-medium transition-colors cursor-pointer px-3 py-1.5 rounded-md"
              style={{
                color: activePath === "/quotas" ? "#38bdf8" : "#94a3b8",
                background:
                  activePath === "/quotas"
                    ? "rgba(14,165,233,0.08)"
                    : "transparent",
              }}
              data-testid="link-nav-quotas"
            >
              <Coins className="w-3.5 h-3.5" /> Квоты
            </span>
          </Link>
          <Link href="/exchange">
            <span
              className="flex items-center gap-1.5 text-[13px] font-medium transition-colors cursor-pointer px-3 py-1.5 rounded-md"
              style={{
                color: activePath === "/exchange" ? "#38bdf8" : "#94a3b8",
                background:
                  activePath === "/exchange"
                    ? "rgba(14,165,233,0.08)"
                    : "transparent",
              }}
              data-testid="link-nav-exchange"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" /> Биржа
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 inline-block" />
            онлайн
          </div>
          {hostToken && <BalanceChip hostToken={hostToken} />}
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

      <MobileMenu activePath={activePath} />
    </nav>
  );
}

function MobileMenu({ activePath }: { activePath?: string }) {
  return (
    <div
      className="md:hidden border-t flex items-center gap-0 overflow-x-auto px-4 h-10"
      style={{ borderColor: "rgba(255,255,255,0.05)" }}
    >
      {/* Player branch */}
      <Link href="/games">
        <span
          className="flex items-center gap-1 text-[12px] font-medium px-3 py-1 rounded whitespace-nowrap"
          style={{ color: activePath === "/games" ? "#38bdf8" : "#94a3b8" }}
          data-testid="link-mobile-games"
        >
          <Gamepad2 className="w-3 h-3" /> Играть
        </span>
      </Link>
      <Link href="/profile">
        <span
          className="flex items-center gap-1 text-[12px] font-medium px-3 py-1 rounded whitespace-nowrap"
          style={{ color: activePath === "/profile" ? "#38bdf8" : "#94a3b8" }}
          data-testid="link-mobile-profile"
        >
          <UserCircle2 className="w-3 h-3" /> Профиль
        </span>
      </Link>
      <div
        className="mx-1.5 h-3.5 w-px shrink-0"
        style={{ background: "rgba(255,255,255,0.1)" }}
      />
      {/* Host branch */}
      <Link href="/host">
        <span
          className="flex items-center gap-1 text-[12px] font-medium px-3 py-1 rounded whitespace-nowrap"
          style={{
            color:
              activePath === "/host" || activePath === "/wallet"
                ? "#38bdf8"
                : "#94a3b8",
          }}
          data-testid="link-mobile-host"
        >
          <Cpu className="w-3 h-3" /> Хостить
        </span>
      </Link>
      <Link href="/quotas">
        <span
          className="flex items-center gap-1 text-[12px] font-medium px-3 py-1 rounded whitespace-nowrap"
          style={{ color: activePath === "/quotas" ? "#38bdf8" : "#94a3b8" }}
          data-testid="link-mobile-quotas"
        >
          <Coins className="w-3 h-3" /> Квоты
        </span>
      </Link>
      <Link href="/exchange">
        <span
          className="flex items-center gap-1 text-[12px] font-medium px-3 py-1 rounded whitespace-nowrap"
          style={{ color: activePath === "/exchange" ? "#38bdf8" : "#94a3b8" }}
          data-testid="link-mobile-exchange"
        >
          <ArrowLeftRight className="w-3 h-3" /> Биржа
        </span>
      </Link>
    </div>
  );
}
