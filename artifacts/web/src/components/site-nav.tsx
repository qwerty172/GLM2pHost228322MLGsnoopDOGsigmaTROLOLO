import { Link, useLocation } from "wouter";
import { useState } from "react";
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
import { useQuickPalette } from "@/components/quick-command-palette";
import { Kbd } from "@/components/ui/kbd";
import { toast } from "sonner";

type NavKey =
  | "/"
  | "/games"
  | "/hosts"
  | "/quotas"
  | "/host"
  | "/host/wallet"
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
  const { toggle: togglePalette } = useQuickPalette();
  const { playerWalletToken, isGuest, upgradeGuest } = usePlayerWallet();
  const [guestExpanded, setGuestExpanded] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [upgrading, setUpgrading] = useState(false);
  const walletToken = playerWalletToken ?? hostToken ?? null;
  const [, navigate] = useLocation();

  const isActive = (path: string) => activePath === path;
  const isHostActive =
    activePath === "/host" ||
    activePath === "/host/wallet" ||
    activePath === "/wallet";
  const hideGuestBanner =
    typeof activePath === "string" &&
    (activePath.startsWith("/play") || activePath.startsWith("/host/play"));

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
          <Link href="/hosts">
            <span
              className="flex items-center gap-1.5 text-[13px] font-semibold transition-colors cursor-pointer px-3 py-1.5 rounded-md"
              style={{
                color: isActive("/hosts") ? "#38bdf8" : "#e2e8f0",
                background: isActive("/hosts") ? "rgba(14,165,233,0.08)" : "transparent",
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
          {/* Quick actions palette */}
          <button
            type="button"
            onClick={togglePalette}
            className="hidden sm:flex items-center gap-2 h-8 px-2.5 rounded-md transition-colors hover:bg-white/5 text-slate-500 hover:text-slate-300"
            style={{ border: "1px solid rgba(255,255,255,0.06)" }}
            title="Быстрые действия (Ctrl+K)"
            aria-label="Быстрые действия"
            data-testid="button-nav-search"
          >
            <Search className="w-3.5 h-3.5 shrink-0" />
            <span className="text-[12px]">Быстро</span>
            <Kbd className="hidden lg:inline-flex bg-white/5 text-slate-500 border border-white/10">
              {typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
                ? "⌘K"
                : "Ctrl+K"}
            </Kbd>
          </button>
          <button
            type="button"
            onClick={togglePalette}
            className="sm:hidden w-8 h-8 flex items-center justify-center rounded-md transition-colors hover:bg-white/5"
            style={{ color: "#64748b" }}
            title="Быстрые действия"
            aria-label="Быстрые действия"
            data-testid="button-nav-search-mobile"
          >
            <Search className="w-4 h-4" />
          </button>

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
                aria-label="Профиль"
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

      {/* Guest banner — скрыт на странице игры; компактный на остальных */}
      {playerWalletToken && isGuest && !hideGuestBanner && (
        <div
          className="px-4 py-1.5 flex items-center justify-center gap-3 text-xs border-b"
          style={{
            background: "rgba(245,158,11,0.06)",
            borderColor: "rgba(245,158,11,0.12)",
            color: "#fbbf24",
          }}
        >
          <span>Гостевой режим</span>
          {!guestExpanded ? (
            <button
              type="button"
              className="underline hover:text-amber-200"
              onClick={() => setGuestExpanded(true)}
            >
              Сохранить аккаунт
            </button>
          ) : (
            <>
              <input
                type="text"
                placeholder="Имя"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="h-7 px-2 rounded bg-black/30 border border-amber-500/30 text-amber-100 w-28"
              />
              <button
                type="button"
                disabled={upgrading || guestName.trim().length < 2}
                className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-50"
                onClick={() => {
                  setUpgrading(true);
                  void upgradeGuest(guestName.trim()).then((ok) => {
                    setUpgrading(false);
                    if (ok) {
                      toast.success("Аккаунт создан");
                      setGuestExpanded(false);
                    } else toast.error("Не удалось создать аккаунт");
                  });
                }}
              >
                {upgrading ? "…" : "Готово"}
              </button>
              <button
                type="button"
                className="text-slate-500 hover:text-slate-300"
                aria-label="Закрыть"
                onClick={() => setGuestExpanded(false)}
              >
                ✕
              </button>
            </>
          )}
        </div>
      )}
    </nav>
  );
}

function MobileMenu({ activePath }: { activePath?: string }) {
  const isHostActive =
    activePath === "/host" ||
    activePath === "/host/wallet" ||
    activePath === "/wallet";

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
