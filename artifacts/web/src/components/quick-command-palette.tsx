import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "wouter";
import {
  ArrowLeftRight,
  Coins,
  Cpu,
  Download,
  Gamepad2,
  Library,
  MonitorPlay,
  Play,
  Plus,
  Settings,
  UserCircle2,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { parsePlayLink, playHref } from "@/lib/parse-play-link";
import { useAuth } from "@/hooks/use-auth";

type PaletteAction = {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  keywords: string[];
  href?: string;
  onSelect?: () => void;
  shortcut?: string;
};

type QuickPaletteContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

const QuickPaletteContext = createContext<QuickPaletteContextValue | null>(null);

export function useQuickPalette(): QuickPaletteContextValue {
  const ctx = useContext(QuickPaletteContext);
  if (!ctx) {
    throw new Error("useQuickPalette must be used within QuickPaletteProvider");
  }
  return ctx;
}

function navigateTo(href: string) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const path = href.startsWith("/") ? href : `/${href}`;
  window.location.href = `${base}${path}`;
}

export function QuickPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => setOpen((o) => !o), []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  return (
    <QuickPaletteContext.Provider value={{ open, setOpen, toggle }}>
      {children}
      <QuickCommandPalette open={open} onOpenChange={setOpen} />
    </QuickPaletteContext.Provider>
  );
}

function QuickCommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [, navigate] = useLocation();
  const { hostToken } = useAuth();
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const playTarget = useMemo(() => parsePlayLink(search), [search]);

  const run = useCallback(
    (action: () => void) => {
      onOpenChange(false);
      action();
    },
    [onOpenChange],
  );

  const nowActions: PaletteAction[] = [
    {
      id: "play-now",
      label: "Играть сейчас",
      hint: "Онлайн-хосты",
      icon: Play,
      keywords: ["играть", "play", "хосты", "онлайн"],
      href: "/hosts",
    },
    {
      id: "games",
      label: "Каталог игр",
      icon: Gamepad2,
      keywords: ["игры", "каталог", "games"],
      href: "/games",
    },
    {
      id: "host-dashboard",
      label: hostToken ? "Панель хоста" : "Стать хостом",
      hint: hostToken ? "Дашборд и агент" : "Регистрация хоста",
      icon: Cpu,
      keywords: ["хост", "host", "дашборд", "стрим"],
      href: "/host",
    },
    {
      id: "new-session",
      label: "Новая сессия",
      hint: "Ссылка для игрока за 1 клик",
      icon: Plus,
      keywords: ["сессия", "стрим", "ссылка", "создать"],
      href: "/host/setup",
    },
    {
      id: "download-agent",
      label: "Скачать агент Windows",
      icon: Download,
      keywords: ["агент", "windows", "zip", "установка"],
      onSelect: () => {
        window.open("/api/downloads/host-agent.zip", "_blank", "noopener");
      },
    },
  ];

  const laterActions: PaletteAction[] = [
    {
      id: "wallet",
      label: "Кошелёк",
      icon: Wallet,
      keywords: ["кошелёк", "lzt", "баланс", "wallet"],
      href: "/wallet",
    },
    {
      id: "profile",
      label: "Профиль",
      icon: UserCircle2,
      keywords: ["профиль", "аккаунт", "profile"],
      href: "/profile",
    },
    {
      id: "library",
      label: "Моя библиотека",
      icon: Library,
      keywords: ["библиотека", "игры хоста", "library"],
      href: "/host/library",
    },
    {
      id: "exchange",
      label: "Биржа",
      icon: ArrowLeftRight,
      keywords: ["биржа", "обмен", "exchange"],
      href: "/exchange",
    },
    {
      id: "quotas",
      label: "Квоты",
      icon: Coins,
      keywords: ["квоты", "quotas", "доступ"],
      href: "/quotas",
    },
    {
      id: "settings",
      label: "Настройки",
      icon: Settings,
      keywords: ["настройки", "settings"],
      href: "/profile?tab=account",
    },
  ];

  const renderAction = (action: PaletteAction) => {
    const Icon = action.icon;
    const select = () => {
      if (action.onSelect) {
        run(action.onSelect);
      } else if (action.href) {
        run(() => navigate(action.href!));
      }
    };

    return (
      <CommandItem
        key={action.id}
        value={`${action.label} ${action.keywords.join(" ")}`}
        onSelect={select}
        className="cursor-pointer"
        data-testid={`quick-palette-${action.id}`}
      >
        <Icon className="text-sky-400" />
        <div className="flex flex-col min-w-0">
          <span>{action.label}</span>
          {action.hint && (
            <span className="text-[11px] text-slate-500 truncate">{action.hint}</span>
          )}
        </div>
        {action.shortcut && <CommandShortcut>{action.shortcut}</CommandShortcut>}
      </CommandItem>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} data-testid="quick-command-palette">
      <DialogContent
        className="overflow-hidden p-0 gap-0 max-w-lg border-0"
        style={{
          background: "#0a1018",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <Command
          className="bg-transparent text-slate-200 [&_[cmdk-group-heading]]:text-slate-500"
        >
          <CommandInput
            placeholder="Играть, хостить или вставь ссылку друга…"
            value={search}
            onValueChange={setSearch}
            data-testid="quick-palette-input"
            className="text-slate-200 placeholder:text-slate-500"
          />
          <CommandList>
            <CommandEmpty>Ничего не найдено</CommandEmpty>

            {playTarget && (
              <CommandGroup heading="Подключиться">
                <CommandItem
                  value={`join ${search}`}
                  onSelect={() => run(() => navigateTo(playHref(playTarget)))}
                  className="cursor-pointer"
                  data-testid="quick-palette-join-link"
                >
                  <MonitorPlay className="text-teal-400" />
                  <div className="flex flex-col min-w-0">
                    <span>Подключиться к игре</span>
                    <span className="text-[11px] text-slate-500 truncate">
                      {playTarget.kind === "invite"
                        ? `Инвайт ${playTarget.code}`
                        : `Токен ${playTarget.token.slice(0, 12)}…`}
                    </span>
                  </div>
                  <CommandShortcut>Enter</CommandShortcut>
                </CommandItem>
              </CommandGroup>
            )}

            <CommandGroup heading="Сейчас">
              {nowActions.map(renderAction)}
            </CommandGroup>

            <CommandSeparator className="bg-white/10" />

            <CommandGroup heading="Потом — когда будет время">
              {laterActions.map(renderAction)}
            </CommandGroup>
          </CommandList>

          <div
            className="border-t px-3 py-2 flex items-center justify-between text-[11px] text-slate-500"
            style={{ borderColor: "rgba(255,255,255,0.06)" }}
          >
            <span className="flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-sky-400" />
              Быстрые действия по всему сайту
            </span>
            <span className="font-mono text-slate-600">
              {typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
                ? "⌘K"
                : "Ctrl+K"}
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
