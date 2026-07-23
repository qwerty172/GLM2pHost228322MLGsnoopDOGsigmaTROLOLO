import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeftRight,
  Coins,
  Cpu,
  Gamepad2,
  LogOut,
  MonitorPlay,
  Search,
  Settings,
  UserCircle2,
  Wallet,
  Zap,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useGetWallet, getGetWalletQueryKey } from "@workspace/api-client-react";
import { usePlayerWallet } from "@/hooks/use-player-wallet";

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

function BalanceChip({ walletToken }: { walletToken: string }) {
  const { data: wallet } = useGetWallet(walletToken, {
    query: { retry: false, staleTime: 30_000, queryKey: getGetWalletQueryKey(walletToken) },
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
  const { hostToken, logout } = useAuth();
  const { playerWalletToken, isGuest } = usePlayerWallet();
  const walletToken = playerWalletToken ?? hostToken ?? null;
  const [, navigate] = useLocation();

  const isActive = (path: string) => activePath === path;
  const isHostActive = activePath === "/host" || activePath === "/wallet";

  return (
    <nav
      className="sticky top-0 z-50 border-b"
      style={{
        background: "rgba(6,11,16,0.92)",
        backdropFilter: "blur(10px)",
        borderColor: "rgba(255,255,255,0.06)",
      }}
    >
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/">
          <div className="flex items-center gap-2 shrink-0 cursor-pointer">
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#0ea5e9,#14b8a6)" }}
            >
              <MonitorPlay className="w-4 h-4 text-white" />
            </div>
            <span className="text-[15px] font-bold text-white tracking-tight hidden sm:block">
              DecentralHub
            </span>
          </div>
        </Link>

        {/* Primary nav — desktop */}
        <div className="hidden md:flex items-center gap-1 flex-1">
          <Link href="/games">
            <span
              className="flex items-center gap-1.5 text-[13px] font-semibold transition-colors cursor-pointer px-3 py-1.5 rounded-md"
              style={{
                color: isActive("/games") ? "#38bdf8" : "#e2e8f0",
                background: isActive("/games") ? "rgba(14,165,233,0.08)" : "transparent",
              }}
              data-testid="link-nav-games"
            >
              <Gamepad2 className="w-3.5 h-3.5" /> Играть
            </span>
          </Link>

          <Link href="/host">
            <span
              className="flex items-center gap-1.5 text-[13px] font-semibold transition-colors cursor-pointer px-3 py-1.5 rounded-md"
              style={{
                color: isHostActive ? "#38bdf8" : "#e2e8f0",
                background: isHostActive ? "rgba(14,165,233,0.08)" : "transparent",
              }}
              data-testid="link-nav-host-panel"
            >
              <Cpu className="w-3.5 h-3.5" /> Хостить
            </span>
          </Link>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Search button */}
          <Link href="/games">
            <button
              type="button"
              className="w-8 h-8 flex items-center justify-center rounded-md transition-colors hover:bg-white/5"
              style={{ color: "#64748b" }}
              title="Поиск игр"
              data-testid="button-nav-search"
            >
              <Search className="w-4 h-4" />
            </button>
          </Link>

          {/* Online indicator — desktop only */}
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 inline-block" />
            онлайн
          </div>

          {/* Balance chip — clickable link to wallet */}
          {walletToken && (
            <Link href="/wallet" data-testid="link-nav-balance">
              <BalanceChip walletToken={walletToken} />
            </Link>
          )}

          {/* Avatar / profile dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="w-8 h-8 flex items-center justify-center rounded-full transition-colors hover:bg-white/8"
                style={{
                  background: isActive("/profile") ? "rgba(14,165,233,0.15)" : "rgba(255,255,255,0.06)",
                  border: isActive("/profile") ? "1px solid rgba(14,165,233,0.3)" : "1px solid rgba(255,255,255,0.1)",
                  color: isActive("/profile") ? "#38bdf8" : "#94a3b8",
                }}
                data-testid="button-nav-avatar"
              >
                <UserCircle2 className="w-4.5 h-4.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48 mt-1"
              style={{
                background: "rgba(10,16,26,0.97)",
                border: "1px solid rgba(255,255,255,0.1)",
                backdropFilter: "blur(12px)",
              }}
            >
              <DropdownMenuItem
                onSelect={() => navigate("/profile")}
                className="cursor-pointer text-slate-300 hover:text-white focus:text-white gap-2"
                data-testid="menu-item-profile"
              >
                <UserCircle2 className="w-4 h-4 shrink-0" />
                Профиль
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => navigate("/wallet")}
                className="cursor-pointer text-slate-300 hover:text-white focus:text-white gap-2"
                data-testid="menu-item-wallet"
              >
                <Wallet className="w-4 h-4 shrink-0" />
                Кошелёк
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => navigate("/profile?tab=account")}
                className="cursor-pointer text-slate-300 hover:text-white focus:text-white gap-2"
                data-testid="menu-item-settings"
              >
                <Settings className="w-4 h-4 shrink-0" />
                Настройки
              </DropdownMenuItem>
              <DropdownMenuSeparator style={{ background: "rgba(255,255,255,0.07)" }} />
              <DropdownMenuItem
                onSelect={() => navigate("/exchange")}
                className="cursor-pointer text-slate-300 hover:text-white focus:text-white gap-2"
                data-testid="menu-item-exchange"
              >
                <ArrowLeftRight className="w-4 h-4 shrink-0" />
                Биржа
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => navigate("/quotas")}
                className="cursor-pointer text-slate-300 hover:text-white focus:text-white gap-2"
                data-testid="menu-item-quotas"
              >
                <Coins className="w-4 h-4 shrink-0" />
                Квоты
              </DropdownMenuItem>
              {hostToken && (
                <>
                  <DropdownMenuSeparator style={{ background: "rgba(255,255,255,0.07)" }} />
                  <DropdownMenuItem
                    onSelect={() => logout()}
                    className="cursor-pointer text-red-400 hover:text-red-300 focus:text-red-300 gap-2"
                    data-testid="menu-item-logout"
                  >
                    <LogOut className="w-4 h-4 shrink-0" />
                    Выйти
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile primary nav */}
      <MobileMenu activePath={activePath} />

      {/* Guest banner */}
      {playerWalletToken && isGuest && (
        <div
          className="px-6 py-1.5 flex items-center justify-center gap-2 text-[11px]"
          style={{
            background: "rgba(245,158,11,0.08)",
            borderBottom: "1px solid rgba(245,158,11,0.15)",
            color: "#fbbf24",
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block shrink-0" />
          Гостевой аккаунт — зарегистрируйся, чтобы пополнить баланс и сохранить историю.
          <Link href="/host">
            <span className="underline cursor-pointer hover:text-amber-300 transition-colors">Войти / создать аккаунт</span>
          </Link>
        </div>
      )}
    </nav>
  );
}

function MobileMenu({ activePath }: { activePath?: string }) {
  const isHostActive = activePath === "/host" || activePath === "/wallet";

  return (
    <div
      className="md:hidden border-t flex items-center gap-0 overflow-x-auto px-4 h-10"
      style={{ borderColor: "rgba(255,255,255,0.05)" }}
    >
      {/* Primary: Играть */}
      <Link href="/games">
        <span
          className="flex items-center gap-1 text-[12px] font-semibold px-3 py-1 rounded whitespace-nowrap"
          style={{ color: activePath === "/games" ? "#38bdf8" : "#e2e8f0" }}
          data-testid="link-mobile-games"
        >
          <Gamepad2 className="w-3 h-3" /> Играть
        </span>
      </Link>

      <div
        className="mx-1.5 h-3.5 w-px shrink-0"
        style={{ background: "rgba(255,255,255,0.1)" }}
      />

      {/* Primary: Хостить */}
      <Link href="/host">
        <span
          className="flex items-center gap-1 text-[12px] font-semibold px-3 py-1 rounded whitespace-nowrap"
          style={{ color: isHostActive ? "#38bdf8" : "#e2e8f0" }}
          data-testid="link-mobile-host"
        >
          <Cpu className="w-3 h-3" /> Хостить
        </span>
      </Link>

      <div
        className="mx-1.5 h-3.5 w-px shrink-0"
        style={{ background: "rgba(255,255,255,0.08)" }}
      />

      {/* Secondary (scrollable) */}
      <Link href="/profile">
        <span
          className="flex items-center gap-1 text-[12px] font-medium px-3 py-1 rounded whitespace-nowrap"
          style={{ color: activePath === "/profile" ? "#38bdf8" : "#64748b" }}
          data-testid="link-mobile-profile"
        >
          <UserCircle2 className="w-3 h-3" /> Профиль
        </span>
      </Link>
      <Link href="/wallet">
        <span
          className="flex items-center gap-1 text-[12px] font-medium px-3 py-1 rounded whitespace-nowrap"
          style={{ color: activePath === "/wallet" ? "#38bdf8" : "#64748b" }}
          data-testid="link-mobile-wallet"
        >
          <Wallet className="w-3 h-3" /> Кошелёк
        </span>
      </Link>
      <Link href="/exchange">
        <span
          className="flex items-center gap-1 text-[12px] font-medium px-3 py-1 rounded whitespace-nowrap"
          style={{ color: activePath === "/exchange" ? "#38bdf8" : "#64748b" }}
          data-testid="link-mobile-exchange"
        >
          <ArrowLeftRight className="w-3 h-3" /> Биржа
        </span>
      </Link>
      <Link href="/quotas">
        <span
          className="flex items-center gap-1 text-[12px] font-medium px-3 py-1 rounded whitespace-nowrap"
          style={{ color: activePath === "/quotas" ? "#38bdf8" : "#64748b" }}
          data-testid="link-mobile-quotas"
        >
          <Coins className="w-3 h-3" /> Квоты
        </span>
      </Link>
    </div>
  );
}
