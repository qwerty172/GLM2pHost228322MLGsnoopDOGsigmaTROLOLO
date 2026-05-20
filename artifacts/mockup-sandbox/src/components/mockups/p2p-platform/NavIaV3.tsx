import {
  Gamepad2,
  Briefcase,
  Wallet,
  Server,
  Gauge,
  ArrowRightLeft,
  MessageSquare,
  Users,
  HandCoins,
  Search,
  ChevronDown,
  Bell,
  Plus,
  ArrowDownToLine,
  ArrowUpFromLine,
  Crown,
  Zap,
  Lock,
} from "lucide-react";

const sky = "text-sky-400";
const emerald = "text-emerald-400";

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-8 w-8 rounded-lg bg-gradient-to-br from-sky-500 to-emerald-500 grid place-items-center">
        <span className="text-[13px] font-black text-slate-950">DH</span>
      </div>
      <div className="leading-tight">
        <div className="text-[13px] font-bold tracking-wide text-slate-100">DecentralHub</div>
        <div className="text-[10px] text-slate-500 -mt-0.5">P2P cloud gaming</div>
      </div>
    </div>
  );
}

function NavButton({
  icon: Icon,
  label,
  sub,
  active = false,
  accent = "sky",
}: {
  icon: any;
  label: string;
  sub: string;
  active?: boolean;
  accent?: "sky" | "emerald" | "violet";
}) {
  const ring =
    accent === "emerald"
      ? "ring-emerald-500/30 bg-emerald-500/5"
      : accent === "violet"
      ? "ring-violet-500/30 bg-violet-500/5"
      : "ring-sky-500/30 bg-sky-500/5";
  const ic =
    accent === "emerald" ? "text-emerald-400" : accent === "violet" ? "text-violet-400" : "text-sky-400";
  return (
    <button
      className={`group flex items-center gap-2.5 rounded-xl px-3 py-2 transition ${
        active ? `ring-1 ${ring}` : "hover:bg-slate-800/50"
      }`}
    >
      <Icon className={`h-4 w-4 ${active ? ic : "text-slate-400 group-hover:text-slate-200"}`} />
      <div className="text-left leading-tight">
        <div className={`text-[13px] font-semibold ${active ? "text-slate-100" : "text-slate-200"}`}>
          {label}
        </div>
        <div className="text-[10px] text-slate-500">{sub}</div>
      </div>
      <ChevronDown
        className={`h-3.5 w-3.5 ${active ? ic : "text-slate-500"} transition group-hover:translate-y-0.5`}
      />
    </button>
  );
}

function CornerProfile() {
  return (
    <div className="flex items-center gap-2">
      <button className="relative grid h-9 w-9 place-items-center rounded-lg bg-slate-800/70 hover:bg-slate-700/70">
        <Bell className="h-4 w-4 text-slate-300" />
        <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-emerald-500 text-[9px] font-bold text-slate-950">
          3
        </span>
      </button>

      {/* Wallet pill — синий+зелёный балансы */}
      <button className="flex items-center gap-2.5 rounded-xl bg-slate-800/70 px-2.5 py-1.5 ring-1 ring-slate-700/70 hover:ring-slate-600">
        <Wallet className="h-4 w-4 text-sky-400" />
        <div className="leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-sky-400">1 240</span>
            <span className="text-[9px] text-slate-500">LZT</span>
            <span className="text-slate-600">·</span>
            <span className="text-[11px] font-bold text-emerald-400">386</span>
            <span className="text-[9px] text-slate-500">LZT</span>
          </div>
          <div className="flex items-center gap-1 text-[9px] text-slate-500 -mt-0.5">
            <span>внутр.</span>
            <span>·</span>
            <span>вывод</span>
          </div>
        </div>
      </button>

      {/* Profile chip with menu hint */}
      <button className="flex items-center gap-2 rounded-xl bg-slate-800/70 px-2 py-1.5 ring-1 ring-slate-700/70 hover:ring-slate-600">
        <div className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-sky-500/40 to-emerald-500/40 text-[11px] font-bold text-slate-100">
          IK
        </div>
        <div className="leading-tight text-left">
          <div className="text-[12px] font-semibold text-slate-100">Иван К.</div>
          <div className="flex items-center gap-1 text-[9px]">
            <Crown className="h-2.5 w-2.5 text-amber-400" />
            <span className="text-amber-400">Premium</span>
            <span className="text-slate-600">·</span>
            <span className="text-emerald-400">+12 рейт</span>
          </div>
        </div>
        <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
      </button>
    </div>
  );
}

function Dropdown({
  title,
  subtitle,
  accent,
  items,
  footer,
}: {
  title: string;
  subtitle: string;
  accent: "sky" | "emerald" | "violet";
  items: {
    icon: any;
    label: string;
    desc: string;
    badge?: { text: string; tone: "sky" | "emerald" | "amber" | "slate" };
  }[];
  footer?: React.ReactNode;
}) {
  const tone = {
    sky: { ring: "ring-sky-500/20", glow: "shadow-[0_0_40px_-12px_rgba(56,189,248,0.25)]", text: "text-sky-400" },
    emerald: {
      ring: "ring-emerald-500/20",
      glow: "shadow-[0_0_40px_-12px_rgba(52,211,153,0.25)]",
      text: "text-emerald-400",
    },
    violet: {
      ring: "ring-violet-500/20",
      glow: "shadow-[0_0_40px_-12px_rgba(167,139,250,0.22)]",
      text: "text-violet-400",
    },
  }[accent];

  const badgeTone = (t: "sky" | "emerald" | "amber" | "slate") =>
    ({
      sky: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
      emerald: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
      amber: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
      slate: "bg-slate-700/40 text-slate-300 ring-slate-600/40",
    }[t]);

  return (
    <div
      className={`rounded-2xl bg-slate-900/95 ring-1 ${tone.ring} ${tone.glow} backdrop-blur-xl overflow-hidden`}
    >
      <div className="px-4 pt-4 pb-3 border-b border-slate-800/70">
        <div className={`text-[10px] font-bold uppercase tracking-[0.18em] ${tone.text}`}>{title}</div>
        <div className="text-[11px] text-slate-500 mt-0.5">{subtitle}</div>
      </div>
      <div className="p-2">
        {items.map((it) => (
          <button
            key={it.label}
            className="w-full flex items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-slate-800/60 transition"
          >
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-800/80">
              <it.icon className={`h-4 w-4 ${tone.text}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-slate-100">{it.label}</span>
                {it.badge && (
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[9px] font-semibold ring-1 ${badgeTone(it.badge.tone)}`}
                  >
                    {it.badge.text}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 leading-snug mt-0.5">{it.desc}</div>
            </div>
          </button>
        ))}
      </div>
      {footer && <div className="border-t border-slate-800/70 px-4 py-2.5">{footer}</div>}
    </div>
  );
}

function ProfileDrawer() {
  return (
    <div className="rounded-2xl bg-slate-900/95 ring-1 ring-slate-700/60 backdrop-blur-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-800/70">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-sky-500/40 to-emerald-500/40 text-[15px] font-bold text-slate-100">
            IK
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[14px] font-bold text-slate-100">Иван Калинин</span>
              <Crown className="h-3.5 w-3.5 text-amber-400" />
            </div>
            <div className="text-[11px] text-slate-500">@ivan_k · с мая 2026</div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
                Кредитный рейт A+
              </span>
              <span className="text-[9px] text-slate-500">22/22 возвратов</span>
            </div>
          </div>
        </div>

        {/* Dual balance compact */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-sky-500/10 ring-1 ring-sky-500/20 px-2.5 py-2">
            <div className="text-[9px] text-sky-300/80">Внутренний (синий)</div>
            <div className="text-[14px] font-bold text-sky-300">1 240 LZT</div>
            <div className="text-[9px] text-slate-500">≈ 6.20 USDT</div>
          </div>
          <div className="rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20 px-2.5 py-2">
            <div className="text-[9px] text-emerald-300/80">Вывод (зелёный)</div>
            <div className="text-[14px] font-bold text-emerald-300">386 LZT</div>
            <div className="text-[9px] text-slate-500">≈ 1.93 USDT</div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="px-3 py-2 grid grid-cols-3 gap-1.5 border-b border-slate-800/70">
        <button className="flex flex-col items-center gap-1 rounded-lg py-2 hover:bg-slate-800/60">
          <Plus className="h-3.5 w-3.5 text-sky-400" />
          <span className="text-[10px] text-slate-300">Пополнить</span>
        </button>
        <button className="flex flex-col items-center gap-1 rounded-lg py-2 hover:bg-slate-800/60">
          <ArrowDownToLine className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-[10px] text-slate-300">Вывод</span>
        </button>
        <button className="flex flex-col items-center gap-1 rounded-lg py-2 hover:bg-slate-800/60">
          <ArrowRightLeft className="h-3.5 w-3.5 text-violet-400" />
          <span className="text-[10px] text-slate-300">Обмен</span>
        </button>
      </div>

      {/* Section: Chats */}
      <div className="px-4 pt-3 pb-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Чаты</span>
          <span className="text-[10px] text-emerald-400">2 новых</span>
        </div>
      </div>
      <div className="px-2">
        {[
          { name: "Хост · sasha_pc", msg: "GPU свободна, 0.8 LZT/мин", t: "12м", dot: true },
          { name: "Должник · neon_42", msg: "Верну до пятницы 👌", t: "1ч", dot: true },
          { name: "Сделка #LZ-908", msg: "Эскроу зафиксировано", t: "вчера", dot: false },
        ].map((c) => (
          <button key={c.name} className="w-full flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-slate-800/60 text-left">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-slate-800 text-[10px] font-bold text-slate-300">
              {c.name[0]}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-200 truncate">{c.name}</span>
                <span className="text-[9px] text-slate-500">{c.t}</span>
              </div>
              <div className="text-[10px] text-slate-500 truncate">{c.msg}</div>
            </div>
            {c.dot && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
          </button>
        ))}
      </div>

      {/* Section: Credits */}
      <div className="px-4 pt-3 pb-1.5 border-t border-slate-800/70 mt-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Кредиты</span>
          <button className="text-[10px] text-sky-400 hover:text-sky-300">всё на бирже →</button>
        </div>
      </div>
      <div className="px-3 pb-3 space-y-1.5">
        <div className="rounded-lg bg-amber-500/5 ring-1 ring-amber-500/20 px-2.5 py-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-200">Игра в долг</span>
            <span className="text-[11px] font-bold text-amber-300">−1 840 LZT</span>
          </div>
          <div className="text-[10px] text-slate-500">авто-кредит · лимит $30 · 18 / 30</div>
          <div className="mt-1.5 h-1 rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full w-[60%] bg-amber-400/70" />
          </div>
        </div>
        <div className="rounded-lg bg-slate-800/40 ring-1 ring-slate-700/40 px-2.5 py-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-200">Тебе должны (3 чел.)</span>
            <span className="text-[11px] font-bold text-emerald-300">+4 200 LZT</span>
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-[10px] text-slate-500">средний срок 4 дня</span>
            <button className="text-[10px] text-sky-400">пингануть</button>
          </div>
        </div>
        <button className="w-full flex items-center justify-between rounded-lg bg-slate-800/40 hover:bg-slate-800 px-2.5 py-2">
          <span className="text-[11px] text-slate-300">P2P-займы и торговля долгами</span>
          <span className="text-[10px] text-sky-400">→ Биржа</span>
        </button>
      </div>
    </div>
  );
}

export function NavIaV3() {
  return (
    <div className="min-h-screen bg-[#070b14] text-slate-200 font-sans antialiased">
      {/* Very subtle ambient — мягкое свечение мало */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-sky-500/5 via-transparent to-transparent" />
      <div className="pointer-events-none absolute right-0 top-40 h-64 w-64 rounded-full bg-emerald-500/5 blur-3xl" />

      {/* TOP NAV BAR */}
      <header className="relative border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1240px] items-center gap-6 px-6 py-3">
          <Logo />

          <nav className="flex items-center gap-1 ml-2">
            <NavButton icon={Zap} label="Быстрые действия" sub="играй · зарабатывай · плати" active accent="sky" />
            <NavButton icon={Server} label="Хостинг" sub="GPU · квоты · доход" accent="emerald" />
            <NavButton icon={ArrowRightLeft} label="Биржа · Форум" sub="сделки · кредиты · чат" accent="violet" />
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <button className="hidden lg:flex items-center gap-2 rounded-lg bg-slate-800/60 px-3 py-1.5 text-[12px] text-slate-400 ring-1 ring-slate-700/60 hover:ring-slate-600 min-w-[200px]">
              <Search className="h-3.5 w-3.5" />
              <span>Поиск игр, юзеров, сделок…</span>
              <span className="ml-auto rounded bg-slate-900 px-1 py-0.5 text-[9px] text-slate-500">⌘K</span>
            </button>
            <CornerProfile />
          </div>
        </div>
      </header>

      {/* STAGE: показываем три раскрытых дропдауна + правый ящик профиля */}
      <div className="relative mx-auto max-w-[1240px] px-6 pt-2 pb-10">
        <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500 mb-3">
          ↓ для превью: показаны все три меню + ящик профиля одновременно
        </div>

        <div className="grid grid-cols-[1fr_1fr_1fr_320px] gap-3">
          {/* 1. Быстрые действия */}
          <Dropdown
            title="1 · Быстрые действия"
            subtitle="для случайного юзера — играй и плати"
            accent="sky"
            items={[
              {
                icon: Gamepad2,
                label: "P2P игры",
                desc: "найти хост, подключиться, играть — оплата по минутам",
                badge: { text: "152 онлайн", tone: "sky" },
              },
              {
                icon: Briefcase,
                label: "Фриланс-биржа",
                desc: "обычные задания, заказы, услуги — берёшь и зарабатываешь",
                badge: { text: "новое", tone: "amber" },
              },
              {
                icon: Wallet,
                label: "Баланс",
                desc: "оба счёта, пополнение, вывод, быстрый микрозайм от платформы",
              },
            ]}
            footer={
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>Активный счёт: внутренний</span>
                <span className="text-sky-400">⌥ переключить</span>
              </div>
            }
          />

          {/* 2. Хостинг */}
          <Dropdown
            title="2 · Хостинг"
            subtitle="подними железо, получай доход"
            accent="emerald"
            items={[
              {
                icon: Server,
                label: "Открыть хост",
                desc: "браузер / агент · тонкие настройки спрятаны",
                badge: { text: "по умолч. 10 мин в долг", tone: "emerald" },
              },
              {
                icon: Gauge,
                label: "Квоты",
                desc: "роялти, спонсор-эскроу — все хостеры тут",
              },
              {
                icon: ArrowRightLeft,
                label: "→ Биржа",
                desc: "перейти к P2P-сделкам, кредитам, чату",
                badge: { text: "переход", tone: "slate" },
              },
            ]}
            footer={
              <div className="flex items-center gap-2 text-[10px] text-slate-500">
                <Lock className="h-3 w-3 text-amber-400" />
                <span>Бесплатный геймплей в общий список — только с</span>
                <Crown className="h-3 w-3 text-amber-400" />
                <span className="text-amber-300">Premium</span>
              </div>
            }
          />

          {/* 3. Биржа · Форум */}
          <Dropdown
            title="3 · Биржа · Форум"
            subtitle="экономика, сделки, комьюнити"
            accent="violet"
            items={[
              {
                icon: Search,
                label: "Поисковик сделок",
                desc: "P2P-займы, торговля долгами, фильтры по ставке/сроку",
                badge: { text: "843 актив.", tone: "sky" },
              },
              {
                icon: Users,
                label: "Профили: должники / кредиторы",
                desc: "рейтинг, история возвратов, пингануть просрочку",
              },
              {
                icon: HandCoins,
                label: "Кредиты P2P",
                desc: "взять / выдать вручную, эскроу-контракты",
              },
              {
                icon: MessageSquare,
                label: "Общий чат · FAQ",
                desc: "обсуждение, помощь новичкам, объявления",
                badge: { text: "412 онл.", tone: "emerald" },
              },
            ]}
          />

          {/* 4. Profile drawer (corner) */}
          <ProfileDrawer />
        </div>

        {/* Annotation row */}
        <div className="mt-6 grid grid-cols-4 gap-3 text-[11px]">
          <div className="rounded-lg border border-dashed border-sky-500/30 bg-sky-500/5 px-3 py-2 text-sky-300/90">
            <b>Раздел 1.</b> «Кликнул — играешь / зарабатываешь / платишь». Микрозайм встроен прямо в Баланс.
          </div>
          <div className="rounded-lg border border-dashed border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-emerald-300/90">
            <b>Раздел 2.</b> Дефолт = упрощённый запуск. Тонкие настройки + автокредит на 10 мин · лимит $30–60.
          </div>
          <div className="rounded-lg border border-dashed border-violet-500/30 bg-violet-500/5 px-3 py-2 text-violet-300/90">
            <b>Раздел 3.</b> Поисковик сделок + чат + профили должников. Кросс-линк сюда из Хостинга.
          </div>
          <div className="rounded-lg border border-dashed border-slate-600/40 bg-slate-800/30 px-3 py-2 text-slate-400">
            <b>Угол.</b> Колокол · Кошелёк (синий+зелёный) · Профиль. Внутри профиля — чаты и кредиты со ссылками на Биржу.
          </div>
        </div>
      </div>
    </div>
  );
}
