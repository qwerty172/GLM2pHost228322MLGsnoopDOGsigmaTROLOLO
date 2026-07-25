import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { LayoutDashboard, Wallet, LogOut, Library } from "lucide-react";
import { SiteNav } from "@/components/site-nav";

export function HostLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { logout } = useAuth();

  const navItems = [
    { href: "/host", label: "Дашборд", icon: LayoutDashboard },
    { href: "/host/library", label: "Моя библиотека", icon: Library },
    { href: "/wallet", label: "Кошелёк", icon: Wallet },
  ];

  return (
    <div
      className="min-h-screen flex flex-col text-slate-300"
      style={{ background: "#06090e" }}
    >
      <SiteNav activePath={location.startsWith("/wallet") ? "/wallet" : "/host"} />
      <div
        className="border-b"
        style={{
          background: "rgba(10,16,24,0.6)",
          borderColor: "rgba(255,255,255,0.05)",
        }}
      >
        <div className="max-w-6xl mx-auto px-6 h-11 flex items-center gap-6">
          {navItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                data-testid={`link-host-${item.href.replace(/\//g, "-")}`}
              >
                <span
                  className="flex items-center gap-1.5 text-[12.5px] font-medium cursor-pointer transition-colors"
                  style={{ color: isActive ? "#38bdf8" : "#94a3b8" }}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={logout}
            className="ml-auto flex items-center gap-1.5 text-[12.5px] text-slate-500 hover:text-red-400 transition-colors"
            data-testid="button-logout"
          >
            <LogOut className="h-3.5 w-3.5" />
            Выйти
          </button>
        </div>
      </div>
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-8">{children}</main>
    </div>
  );
}
