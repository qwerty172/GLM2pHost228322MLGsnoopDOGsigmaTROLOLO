import { useCallback, useEffect, useState } from "react";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  Coins,
  Key,
  Settings,
  Database,
  CalendarClock,
  SlidersHorizontal,
  ListTodo,
} from "lucide-react";

const ADMIN_SECRET_KEY = "streamline.adminSecret";

type Tab =
  | "settings"
  | "reserves"
  | "keys"
  | "drips"
  | "adjustments"
  | "marathon";

type PlatformSettings = {
  weeklyInterestRateHbps: number;
  guestCreditLimitLzt: number;
  defaultCreditLimitLzt: number;
  welcomeBonusLzt: number;
  interestEnabled: boolean;
  updatedAt: string;
};

type DevKeyRow = {
  id: string;
  apiKeyMasked: string;
  displayName: string;
  status: string;
  internalBalanceLzt: number;
  withdrawableBalanceLzt: number;
  createdAt: string;
};

type DripRow = {
  id: string;
  ownerType: string;
  ownerId: string;
  amountLztPerTick: number;
  interval: string;
  ticksTotal: number;
  ticksDone: number;
  status: string;
  note: string;
  nextTickAt: string;
};

type AuditRow = {
  id: string | number;
  kind: string;
  deltaLzt: number;
  note?: string | null;
};

function readAdminSecret(): string {
  try {
    return sessionStorage.getItem(ADMIN_SECRET_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeAdminSecret(value: string): void {
  try {
    if (value) sessionStorage.setItem(ADMIN_SECRET_KEY, value);
    else sessionStorage.removeItem(ADMIN_SECRET_KEY);
  } catch {
    /* ignore */
  }
}

function adminHeaders(hostToken: string): Record<string, string> {
  const secret = readAdminSecret();
  return {
    "Content-Type": "application/json",
    "X-Host-Token": hostToken,
    ...(secret ? { "X-Admin-Secret": secret } : {}),
  };
}

const cardStyle = {
  background: "#0a1018",
  border: "1px solid rgba(255,255,255,0.06)",
};

const tabs: { id: Tab; label: string; icon: typeof Settings }[] = [
  { id: "settings", label: "Настройки", icon: Settings },
  { id: "reserves", label: "Резервы", icon: Database },
  { id: "keys", label: "API-ключи", icon: Key },
  { id: "drips", label: "Выплаты", icon: CalendarClock },
  { id: "adjustments", label: "Корректировки", icon: SlidersHorizontal },
  { id: "marathon", label: "MARATHON", icon: ListTodo },
];

export default function AdminEconomyPage() {
  const { hostToken } = useAuth();
  const [tab, setTab] = useState<Tab>("settings");
  const [adminSecret, setAdminSecret] = useState(readAdminSecret);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [reserves, setReserves] = useState<{
    systemAccounts: Array<{ key: string; balanceLzt: number }>;
    pendingWithdrawals: number;
  } | null>(null);
  const [keys, setKeys] = useState<DevKeyRow[] | null>(null);
  const [drips, setDrips] = useState<DripRow[] | null>(null);
  const [audit, setAudit] = useState<AuditRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");

  const fetchJson = useCallback(
    async (path: string, init?: RequestInit) => {
      if (!hostToken) throw new Error("Нет hostToken");
      const res = await fetch(`${base}${path}`, {
        ...init,
        headers: { ...adminHeaders(hostToken), ...(init?.headers ?? {}) },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : data.message ?? `HTTP ${res.status}`,
        );
      }
      return data;
    },
    [base, hostToken],
  );

  const reload = useCallback(async () => {
    if (!hostToken) return;
    setLoading(true);
    try {
      if (tab === "settings") {
        setSettings(await fetchJson("/api/admin/economy/settings"));
      } else if (tab === "reserves") {
        setReserves(await fetchJson("/api/admin/economy/reserves"));
      } else if (tab === "keys") {
        setKeys(await fetchJson("/api/admin/economy/dev-keys"));
      } else if (tab === "drips") {
        setDrips(await fetchJson("/api/admin/economy/drips"));
      } else if (tab === "adjustments") {
        setAudit(await fetchJson("/api/admin/economy/adjustments"));
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [fetchJson, hostToken, tab]);

  useEffect(() => {
    void reload();
  }, [reload, adminSecret]);

  async function saveSettings(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!settings) return;
    try {
      const updated = await fetchJson("/api/admin/economy/settings", {
        method: "PATCH",
        body: JSON.stringify({
          weeklyInterestRateHbps: settings.weeklyInterestRateHbps,
          guestCreditLimitLzt: settings.guestCreditLimitLzt,
          defaultCreditLimitLzt: settings.defaultCreditLimitLzt,
          welcomeBonusLzt: settings.welcomeBonusLzt,
          interestEnabled: settings.interestEnabled,
        }),
      });
      setSettings(updated);
      toast.success("Настройки сохранены");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (!hostToken) {
    return (
      <div className="min-h-screen text-slate-300" style={{ background: "#06090e" }}>
        <SiteNav activePath="/admin" />
        <main className="max-w-4xl mx-auto px-6 pt-20 text-center text-slate-500">
          Войди как хост-админ.
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-300" style={{ background: "#06090e" }}>
      <SiteNav activePath="/admin" />
      <main className="max-w-4xl mx-auto px-6 pt-10 pb-16">
        <h1 className="text-2xl font-extrabold text-white mb-1 flex items-center gap-2">
          <Coins className="h-6 w-6 text-sky-400" />
          Экономика платформы
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          Настройки, резервы, API-ключи и скриптованные выплаты. Модерация игр —{" "}
          <span className="text-slate-600">/admin/games (deprecated)</span>
        </p>

        <div className="mb-6">
          <Label className="text-xs text-slate-500">Секрет администратора</Label>
          <Input
            type="password"
            value={adminSecret}
            onChange={(e) => {
              writeAdminSecret(e.target.value);
              setAdminSecret(e.target.value);
            }}
            placeholder="X-Admin-Secret"
            className="mt-1 max-w-sm"
            style={{ background: "#0a1018", border: "1px solid rgba(255,255,255,0.09)" }}
          />
        </div>

        <div className="flex flex-wrap gap-2 mb-6 border-b border-white/5 pb-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-md transition-colors"
              style={{
                background: tab === t.id ? "rgba(14,165,233,0.15)" : "transparent",
                color: tab === t.id ? "#7dd3fc" : "#64748b",
                border: tab === t.id ? "1px solid rgba(14,165,233,0.3)" : "1px solid transparent",
              }}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {loading && <p className="text-sm text-slate-500">Загрузка…</p>}

        {tab === "settings" && settings && (
          <form onSubmit={saveSettings} className="space-y-4 rounded-xl p-5" style={cardStyle}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-slate-400 text-xs">
                  Weekly interest (hbps, 20 = 0.20%/нед)
                </Label>
                <Input
                  type="number"
                  value={settings.weeklyInterestRateHbps}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      weeklyInterestRateHbps: Number(e.target.value),
                    })
                  }
                  className="mt-1"
                />
              </div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={settings.interestEnabled}
                    onChange={(e) =>
                      setSettings({ ...settings, interestEnabled: e.target.checked })
                    }
                  />
                  Проценты включены
                </label>
              </div>
              <div>
                <Label className="text-slate-400 text-xs">Кредит гостя (LZT)</Label>
                <Input
                  type="number"
                  value={settings.guestCreditLimitLzt}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      guestCreditLimitLzt: Number(e.target.value),
                    })
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-slate-400 text-xs">Кредит игрока (LZT)</Label>
                <Input
                  type="number"
                  value={settings.defaultCreditLimitLzt}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      defaultCreditLimitLzt: Number(e.target.value),
                    })
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-slate-400 text-xs">Welcome bonus (LZT)</Label>
                <Input
                  type="number"
                  value={settings.welcomeBonusLzt}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      welcomeBonusLzt: Number(e.target.value),
                    })
                  }
                  className="mt-1"
                />
              </div>
            </div>
            <Button type="submit" className="bg-sky-600 hover:bg-sky-500">
              Сохранить
            </Button>
          </form>
        )}

        {tab === "reserves" && reserves && (
          <div className="rounded-xl p-5 space-y-3" style={cardStyle}>
            <p className="text-sm text-slate-400">
              Pending withdrawals:{" "}
              <span className="text-white font-mono">{reserves.pendingWithdrawals}</span>
            </p>
            {reserves.systemAccounts.map((a) => (
              <div
                key={a.key}
                className="flex justify-between text-sm py-2 border-b border-white/5"
              >
                <span className="font-mono text-slate-300">{a.key}</span>
                <span className="font-mono text-sky-300">
                  {a.balanceLzt.toLocaleString("ru-RU")} LZT
                </span>
              </div>
            ))}
          </div>
        )}

        {tab === "keys" && (
          <div className="space-y-4">
            {createdKey && (
              <div className="rounded-lg p-4 text-sm" style={cardStyle}>
                <p className="text-amber-400 mb-1">Новый ключ (скопируй сейчас):</p>
                <code className="text-xs break-all text-white">{createdKey}</code>
              </div>
            )}
            <form
              className="rounded-xl p-4 grid gap-3 sm:grid-cols-3"
              style={cardStyle}
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                try {
                  const data = await fetchJson("/api/admin/economy/dev-keys", {
                    method: "POST",
                    body: JSON.stringify({
                      displayName: String(fd.get("name") ?? ""),
                      initialBalanceLzt: Number(fd.get("initial") ?? 0),
                    }),
                  });
                  setCreatedKey(data.apiKey);
                  toast.success("Ключ создан");
                  e.currentTarget.reset();
                  void reload();
                } catch (err) {
                  toast.error((err as Error).message);
                }
              }}
            >
              <Input name="name" placeholder="Название" />
              <Input name="initial" type="number" placeholder="Стартовый LZT" />
              <Button type="submit" className="bg-sky-600">Создать ключ</Button>
            </form>
            {keys?.map((k) => (
              <div
                key={k.id}
                className="rounded-lg p-3 flex flex-wrap justify-between gap-2 text-sm"
                style={cardStyle}
              >
                <div>
                  <span className="text-white">{k.displayName || "—"}</span>
                  <span className="text-slate-500 ml-2 font-mono text-xs">{k.apiKeyMasked}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sky-300">{k.internalBalanceLzt} LZT</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await fetchJson(`/api/admin/economy/dev-keys/${k.id}`, {
                          method: "PATCH",
                          body: JSON.stringify({
                            status: k.status === "active" ? "disabled" : "active",
                          }),
                        });
                        void reload();
                      } catch (err) {
                        toast.error((err as Error).message);
                      }
                    }}
                  >
                    {k.status === "active" ? "Отключить" : "Включить"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "drips" && (
          <div className="space-y-4">
            <form
              className="rounded-xl p-4 grid gap-3"
              style={cardStyle}
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                try {
                  await fetchJson("/api/admin/economy/drips", {
                    method: "POST",
                    body: JSON.stringify({
                      ownerType: String(fd.get("ownerType")),
                      ownerTokenOrId: String(fd.get("owner")),
                      amountLztPerTick: Number(fd.get("amount")),
                      interval: String(fd.get("interval")),
                      ticksTotal: Number(fd.get("ticks")),
                      note: String(fd.get("note") ?? ""),
                      purchaseUsdtCents: Number(fd.get("usdCents") ?? 0) || undefined,
                    }),
                  });
                  toast.success("Выплата создана");
                  e.currentTarget.reset();
                  void reload();
                } catch (err) {
                  toast.error((err as Error).message);
                }
              }}
            >
              <div className="grid sm:grid-cols-2 gap-3">
                <select name="ownerType" className="h-9 rounded-md bg-black/30 border border-white/10 px-2">
                  <option value="player">player</option>
                  <option value="host">host</option>
                  <option value="dev_key">dev_key</option>
                </select>
                <Input name="owner" placeholder="playerToken / hostToken / apiKey" />
                <Input name="amount" type="number" placeholder="LZT за период" />
                <select name="interval" className="h-9 rounded-md bg-black/30 border border-white/10 px-2">
                  <option value="daily">daily</option>
                  <option value="weekly">weekly</option>
                </select>
                <Input name="ticks" type="number" placeholder="Кол-во периодов" />
                <Input name="usdCents" type="number" placeholder="USD cents (аудит)" />
              </div>
              <Input name="note" placeholder="Примечание" />
              <Button type="submit" className="bg-sky-600">Создать drip</Button>
            </form>
            {drips?.map((d) => (
              <div key={d.id} className="rounded-lg p-3 text-sm" style={cardStyle}>
                <div className="flex justify-between">
                  <span>
                    {d.ownerType} · {d.amountLztPerTick} LZT / {d.interval}
                  </span>
                  <span className="text-slate-500">
                    {d.ticksDone}/{d.ticksTotal} · {d.status}
                  </span>
                </div>
                {d.note && <p className="text-slate-500 text-xs mt-1">{d.note}</p>}
              </div>
            ))}
          </div>
        )}

        {tab === "adjustments" && (
          <div className="space-y-4">
            <form
              className="rounded-xl p-4 grid gap-3 sm:grid-cols-2"
              style={cardStyle}
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                try {
                  await fetchJson("/api/admin/economy/adjustments", {
                    method: "POST",
                    body: JSON.stringify({
                      ownerType: String(fd.get("ownerType")),
                      ownerTokenOrId: String(fd.get("owner")),
                      bucket: String(fd.get("bucket")),
                      deltaLzt: Number(fd.get("delta")),
                      reason: String(fd.get("reason")),
                    }),
                  });
                  toast.success("Корректировка применена");
                  e.currentTarget.reset();
                  void reload();
                } catch (err) {
                  toast.error((err as Error).message);
                }
              }}
            >
              <select name="ownerType" className="h-9 rounded-md bg-black/30 border border-white/10 px-2">
                <option value="player">player</option>
                <option value="host">host</option>
                <option value="dev_key">dev_key</option>
              </select>
              <Input name="owner" placeholder="token или id" />
              <select name="bucket" className="h-9 rounded-md bg-black/30 border border-white/10 px-2">
                <option value="balance">balance (синий)</option>
                <option value="cash">cash (зелёный)</option>
              </select>
              <Input name="delta" type="number" placeholder="± LZT" />
              <Input name="reason" placeholder="Причина" className="sm:col-span-2" />
              <Button type="submit" className="bg-sky-600 sm:col-span-2">Применить</Button>
            </form>
            <div className="rounded-xl p-4 space-y-2 max-h-96 overflow-auto" style={cardStyle}>
              {audit?.map((row) => (
                <div key={String(row.id)} className="text-xs font-mono text-slate-400 border-b border-white/5 py-1">
                  {row.kind} · {row.deltaLzt} · {row.note ?? ""}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "marathon" && (
          <form
            className="rounded-xl p-4 space-y-3"
            style={cardStyle}
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              try {
                const data = await fetchJson("/api/admin/economy/marathon-task", {
                  method: "POST",
                  body: JSON.stringify({
                    taskTitle: String(fd.get("title")),
                    wave: String(fd.get("wave") ?? "Backlog"),
                  }),
                });
                toast.success(`Задача отправлена (${data.channel})`);
                e.currentTarget.reset();
              } catch (err) {
                toast.error((err as Error).message);
              }
            }}
          >
            <Input name="title" placeholder="Описание задачи" required />
            <Input name="wave" placeholder="Волна (например W16)" />
            <Button type="submit" className="bg-sky-600">Добавить в MARATHON / webhook</Button>
          </form>
        )}
      </main>
    </div>
  );
}
