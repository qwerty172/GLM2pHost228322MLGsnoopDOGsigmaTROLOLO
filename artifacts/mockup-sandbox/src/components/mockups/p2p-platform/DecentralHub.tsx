import React, { useState } from 'react';
import {
  Cpu,
  Gamepad2,
  Globe,
  Star,
  ShieldCheck,
  Wallet,
  ArrowRight,
  ChevronRight,
  Activity,
  Zap,
  Users,
  Lock,
  BarChart2,
  Search,
  SlidersHorizontal,
  CircleDollarSign,
  MonitorPlay,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';

/* ─── colour tokens ──────────────────────────────────────────────────────── */
// bg      #080f14   (near-black, blue-tinted)
// surface #0d1720   (cards / panels)
// border  rgba(255,255,255,0.06)
// accent  #0ea5e9   (sky-500 – the primary teal-blue)
// accent2 #14b8a6   (teal-500 – secondary)
// muted   #64748b   (slate-500)

const hosts = [
  {
    id: 1,
    name: 'CyberSlav99',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
    initials: 'CS',
    rating: 4.9,
    sessions: 128,
    cpu: 'i9-14900K',
    gpu: 'RTX 4090',
    location: 'Frankfurt, DE',
    ping: 12,
    price: '0.45',
    tags: ['прокачанный аккаунт', 'VR Ready'],
    online: true,
    verified: true,
  },
  {
    id: 2,
    name: 'NeonNinja',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
    initials: 'NN',
    rating: 4.8,
    sessions: 84,
    cpu: 'Ryzen 7 7800X3D',
    gpu: 'RTX 4080',
    location: 'Warsaw, PL',
    ping: 24,
    price: '0.30',
    tags: ['Modded GTA V', '1Gbps'],
    online: true,
    verified: true,
  },
  {
    id: 3,
    name: 'TokyoDrift',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
    initials: 'TD',
    rating: null,
    sessions: 0,
    cpu: 'i7-13700K',
    gpu: 'RTX 4070 Ti',
    location: 'Tokyo, JP',
    ping: 148,
    price: '0.25',
    tags: ['лицензия Adobe'],
    online: true,
    verified: false,
  },
];

function PingDot({ ms }: { ms: number }) {
  const color = ms < 50 ? 'bg-teal-400' : ms < 100 ? 'bg-sky-400' : 'bg-slate-500';
  return (
    <span className={`inline-block w-1.5 h-1.5 rounded-full ${color} mr-1`} />
  );
}

export function DecentralHub() {
  const [activeTab, setActiveTab] = useState<'hosts' | 'games'>('hosts');

  return (
    <div
      className="min-h-screen text-slate-300 font-sans"
      style={{ background: '#080f14' }}
    >
      <style>{`
        .surface { background: #0d1720; border: 1px solid rgba(255,255,255,0.06); }
        .row-hover:hover { background: rgba(14,165,233,0.04); }
        .tag-chip {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 4px;
          background: rgba(14,165,233,0.08);
          color: #7dd3fc;
          border: 1px solid rgba(14,165,233,0.15);
          white-space: nowrap;
        }
        .nav-link {
          font-size: 13px;
          font-weight: 500;
          color: #94a3b8;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: color .15s;
          cursor: pointer;
        }
        .nav-link:hover { color: #e2e8f0; }
        .nav-link.active { color: #38bdf8; }
        .soon-badge {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: .06em;
          padding: 1px 5px;
          border-radius: 3px;
          background: rgba(14,165,233,0.08);
          color: #38bdf8;
          border: 1px solid rgba(14,165,233,0.2);
          text-transform: uppercase;
        }
        .stat-num {
          font-size: 22px;
          font-weight: 700;
          color: #f1f5f9;
          letter-spacing: -.5px;
        }
        .stat-label { font-size: 11px; color: #64748b; }
      `}</style>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-50 border-b"
        style={{ background: 'rgba(8,15,20,0.92)', backdropFilter: 'blur(10px)', borderColor: 'rgba(255,255,255,0.06)' }}
      >
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-8">
          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#0ea5e9,#14b8a6)' }}
            >
              <MonitorPlay className="w-4 h-4 text-white" />
            </div>
            <span className="text-[15px] font-bold text-white tracking-tight">NodeRent</span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6">
            <span className="nav-link active"><Gamepad2 className="w-3.5 h-3.5" />Игры</span>
            <span className="nav-link"><Users className="w-3.5 h-3.5" />Хосты</span>
            <span className="nav-link opacity-50 cursor-not-allowed">
              Биржа <span className="soon-badge">скоро</span>
            </span>
            <span className="nav-link opacity-50 cursor-not-allowed">
              Форум <span className="soon-badge">скоро</span>
            </span>
            <span className="nav-link opacity-50 cursor-not-allowed">
              Кредиты <span className="soon-badge">скоро</span>
            </span>
          </div>

          {/* Right */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 inline-block" />
              1 248 онлайн
            </div>
            <Button
              size="sm"
              className="h-8 px-4 text-xs font-semibold rounded-md"
              style={{ background: '#0ea5e9', color: '#fff' }}
            >
              <Wallet className="w-3.5 h-3.5 mr-1.5" /> Кошелёк
            </Button>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pt-14 pb-10 flex flex-col md:flex-row items-start gap-12">
        {/* Left */}
        <div className="flex-1 min-w-0">
          <div
            className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full mb-5"
            style={{ background: 'rgba(14,165,233,0.08)', color: '#38bdf8', border: '1px solid rgba(14,165,233,0.18)' }}
          >
            <Activity className="w-3 h-3" /> WebRTC · P2P · без дата-центров
          </div>

          <h1 className="text-4xl font-extrabold text-white leading-tight tracking-tight mb-4">
            Аренда gaming-ПК<br />
            <span style={{ color: '#0ea5e9' }}>напрямую у владельцев</span>
          </h1>
          <p className="text-slate-400 text-[15px] leading-relaxed mb-7 max-w-lg">
            Никаких серверов компании — только реальные люди со своими GPU.
            Подключайся, плати криптой, запускай любую игру.
          </p>
          <div className="flex items-center gap-3">
            <Button
              className="h-9 px-5 text-sm font-semibold rounded-md"
              style={{ background: '#0ea5e9', color: '#fff' }}
            >
              Найти хоста <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
            <Button
              variant="ghost"
              className="h-9 px-5 text-sm text-slate-400 hover:text-white rounded-md"
            >
              Стать хостом
            </Button>
          </div>
        </div>

        {/* Stats strip */}
        <div
          className="surface rounded-xl p-5 flex gap-8 shrink-0 md:self-center"
        >
          {[
            { num: '1 248', label: 'хостов онлайн', icon: <Cpu className="w-4 h-4" /> },
            { num: '342', label: 'активных сессий', icon: <Activity className="w-4 h-4" /> },
            { num: '$28 400', label: 'выплачено хостам', icon: <CircleDollarSign className="w-4 h-4" /> },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="flex items-center justify-center gap-1 text-teal-400 mb-1 opacity-70">
                {s.icon}
              </div>
              <div className="stat-num">{s.num}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Marketplace ─────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-4">
          {/* Tabs */}
          <div
            className="flex rounded-md p-0.5 gap-0.5 mr-2"
            style={{ background: '#0d1720', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            {(['hosts', 'games'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className="px-4 py-1.5 text-xs font-medium rounded transition-all"
                style={
                  activeTab === t
                    ? { background: 'rgba(14,165,233,0.15)', color: '#38bdf8' }
                    : { color: '#64748b' }
                }
              >
                {t === 'hosts' ? 'Хосты' : 'Игры'}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <Input
              placeholder="Поиск..."
              className="pl-8 h-8 text-xs bg-transparent border-0 surface rounded-md text-slate-300 placeholder:text-slate-600 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>

          <Button variant="ghost" size="sm" className="h-8 px-3 text-slate-500 hover:text-slate-300 gap-1.5 text-xs">
            <SlidersHorizontal className="w-3.5 h-3.5" /> Фильтры
          </Button>

          <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">
            <BarChart2 className="w-3.5 h-3.5" /> Сортировка: рейтинг
          </div>
        </div>

        {/* Table header */}
        <div
          className="grid text-xs text-slate-500 font-medium px-4 py-2 mb-1 rounded-t-md"
          style={{
            gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1fr 100px',
            background: 'rgba(255,255,255,0.02)',
            borderBottom: '1px solid rgba(255,255,255,0.05)'
          }}
        >
          <span>Хост</span>
          <span>Конфигурация</span>
          <span>Локация / Пинг</span>
          <span>Теги</span>
          <span className="text-right">Цена / час</span>
          <span />
        </div>

        {/* Rows */}
        <div className="surface rounded-b-md overflow-hidden divide-y" style={{ borderTop: 'none', borderColor: 'rgba(255,255,255,0.06)' }}>
          {hosts.map((h) => (
            <div
              key={h.id}
              className="row-hover grid items-center px-4 py-3.5 transition-colors cursor-pointer"
              style={{ gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1fr 100px' }}
            >
              {/* Host identity */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={h.avatar} />
                    <AvatarFallback className="text-xs" style={{ background: '#0d1720' }}>{h.initials}</AvatarFallback>
                  </Avatar>
                  {h.online && (
                    <span
                      className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                      style={{ background: '#14b8a6', borderColor: '#0d1720' }}
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-white truncate">{h.name}</span>
                    {h.verified && <ShieldCheck className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
                  </div>
                  {h.rating ? (
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Star className="w-3 h-3 fill-sky-400 text-sky-400" />
                      {h.rating} · {h.sessions} сессий
                    </div>
                  ) : (
                    <span className="text-xs text-slate-600">новый хост</span>
                  )}
                </div>
              </div>

              {/* Config */}
              <div className="text-xs text-slate-400 leading-relaxed">
                <div className="flex items-center gap-1"><Cpu className="w-3 h-3 text-slate-600" />{h.cpu}</div>
                <div className="flex items-center gap-1"><Gamepad2 className="w-3 h-3 text-slate-600" />{h.gpu}</div>
              </div>

              {/* Location */}
              <div className="text-xs text-slate-400">
                <div className="flex items-center gap-1 mb-0.5"><Globe className="w-3 h-3 text-slate-600" />{h.location}</div>
                <div className="flex items-center">
                  <PingDot ms={h.ping} />
                  <span className={h.ping < 50 ? 'text-teal-400' : h.ping < 100 ? 'text-sky-400' : 'text-slate-500'}>
                    {h.ping} мс
                  </span>
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1">
                {h.tags.map((t) => (
                  <span key={t} className="tag-chip">{t}</span>
                ))}
              </div>

              {/* Price */}
              <div className="text-right">
                <span className="text-sm font-bold text-white">${h.price}</span>
                <span className="text-xs text-slate-500 ml-1">USDT</span>
              </div>

              {/* Action */}
              <div className="flex justify-end">
                <Button
                  size="sm"
                  className="h-7 px-3 text-xs font-semibold rounded"
                  style={{ background: 'rgba(14,165,233,0.12)', color: '#38bdf8', border: '1px solid rgba(14,165,233,0.2)' }}
                >
                  Подключить
                </Button>
              </div>
            </div>
          ))}

          {/* View all */}
          <div className="px-4 py-3 flex items-center justify-center">
            <button className="text-xs text-slate-500 hover:text-sky-400 flex items-center gap-1 transition-colors">
              Показать все 1 248 хостов <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ── Bottom info row ──────────────────────────────────────────── */}
        <div className="mt-6 grid grid-cols-3 gap-4">
          {[
            {
              icon: <Zap className="w-4 h-4 text-sky-400" />,
              title: 'WebRTC · нет прокси',
              text: 'Прямое P2P-соединение. Задержка определяется только пингом до хоста.',
            },
            {
              icon: <CircleDollarSign className="w-4 h-4 text-teal-400" />,
              title: 'Крипто-кошелёк встроен',
              text: 'USDT, Nano, Solana. Платишь поминутно, хост получает 95%.',
            },
            {
              icon: <Lock className="w-4 h-4 text-sky-400" />,
              title: 'Открытый протокол',
              text: 'Сигнальный сервер — единственная централизованная точка. Стриминг полностью P2P.',
            },
          ].map((c) => (
            <div key={c.title} className="surface rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                {c.icon}
                <span className="text-sm font-semibold text-white">{c.title}</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">{c.text}</p>
            </div>
          ))}
        </div>

        {/* Upcoming platform sections */}
        <div
          className="mt-4 flex items-center gap-3 px-4 py-3 rounded-lg text-xs text-slate-500"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
        >
          <span className="text-slate-600 font-medium">В разработке:</span>
          {['Фриланс-биржа', 'Форум', 'Кредитная линия'].map((item) => (
            <span key={item} className="flex items-center gap-1">
              <span
                className="px-2 py-0.5 rounded"
                style={{ background: 'rgba(14,165,233,0.06)', color: '#475569', border: '1px solid rgba(14,165,233,0.1)' }}
              >
                {item}
              </span>
            </span>
          ))}
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer
        className="border-t px-6 py-6"
        style={{ borderColor: 'rgba(255,255,255,0.05)' }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-slate-600">
          <span>NodeRent © 2025 · P2P Cloud Gaming</span>
          <div className="flex items-center gap-4">
            <span className="hover:text-slate-400 cursor-pointer transition-colors">Docs</span>
            <span className="hover:text-slate-400 cursor-pointer transition-colors">API</span>
            <span className="hover:text-slate-400 cursor-pointer transition-colors">Github</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default DecentralHub;
