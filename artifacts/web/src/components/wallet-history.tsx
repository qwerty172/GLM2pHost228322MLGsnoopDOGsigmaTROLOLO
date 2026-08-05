import { useState } from "react";
import {
  useListWalletTransactions,
  getListWalletTransactionsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { History, ChevronDown } from "lucide-react";
import {
  WALLET_HISTORY_FILTERS,
  WALLET_HISTORY_PAGE_SIZE,
  type WalletHistoryFilterId,
  filterWalletHistoryByFilter,
  formatWalletHistoryLzt,
  formatWalletHistoryTimestamp,
  walletHistoryBucketMeta,
  walletHistoryKindMeta,
} from "@/lib/wallet-history";

export function WalletHistory({ userToken }: { userToken: string | null }) {
  const [filter, setFilter] = useState<WalletHistoryFilterId>("all");
  const [visible, setVisible] = useState(WALLET_HISTORY_PAGE_SIZE);

  const { data: txs, isLoading } = useListWalletTransactions(userToken ?? "", {
    query: {
      enabled: !!userToken,
      queryKey: getListWalletTransactionsQueryKey(userToken ?? ""),
      staleTime: 30_000,
    },
  });

  const filtered = filterWalletHistoryByFilter(txs ?? [], filter);

  const slice = filtered.slice(0, visible);
  const hasMore = filtered.length > visible;

  return (
    <Card
      style={{
        background: "#0a1018",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
      data-testid="card-wallet-history"
    >
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-white text-base">
            <History className="h-4 w-4 text-sky-400" />
            История операций
          </CardTitle>
          <div className="flex gap-1.5">
            {WALLET_HISTORY_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setFilter(f.id);
                  setVisible(WALLET_HISTORY_PAGE_SIZE);
                }}
                className="text-xs px-3 py-1.5 rounded-full transition-colors"
                style={{
                  background:
                    filter === f.id
                      ? "rgba(14,165,233,0.15)"
                      : "rgba(255,255,255,0.03)",
                  border:
                    filter === f.id
                      ? "1px solid rgba(14,165,233,0.4)"
                      : "1px solid rgba(255,255,255,0.06)",
                  color: filter === f.id ? "#7dd3fc" : "#94a3b8",
                }}
                data-testid={`button-history-filter-${f.id}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton
                key={i}
                className="h-14 w-full rounded-lg"
                style={{ background: "rgba(255,255,255,0.04)" }}
              />
            ))}
          </div>
        ) : slice.length === 0 ? (
          <div
            className="flex flex-col items-center gap-2 py-10 text-slate-500"
            data-testid="text-history-empty"
          >
            <History className="w-8 h-8 opacity-40" />
            <p className="text-sm">
              {filter === "all"
                ? "Операций пока нет."
                : "Нет операций по выбранному фильтру."}
            </p>
            <p className="text-xs text-slate-600">
              Пополни кошелёк или сыграй сессию — операции появятся здесь.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              {slice.map((tx) => {
                const amount = tx.amountLzt ?? 0;
                const meta = walletHistoryKindMeta(tx.kind, amount);
                const bucket = walletHistoryBucketMeta(tx.bucket);
                const Icon = meta.icon;
                const isPositive = amount > 0;
                return (
                  <div
                    key={tx.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors hover:bg-white/[0.02]"
                    style={{
                      border: "1px solid rgba(255,255,255,0.04)",
                    }}
                    data-testid={`row-history-${tx.id}`}
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `${meta.color}14` }}
                    >
                      <Icon
                        className="h-4 w-4"
                        style={{ color: meta.color }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-200 truncate">
                          {meta.label}
                        </span>
                        {bucket && (
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1.5 py-0 border-0 shrink-0"
                            style={{
                              background: `${bucket.color}14`,
                              color: bucket.color,
                            }}
                          >
                            {bucket.label}
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {formatWalletHistoryTimestamp(
                          typeof tx.timestamp === "string"
                            ? tx.timestamp
                            : new Date(tx.timestamp).toISOString(),
                        )}
                        {tx.description && tx.description !== tx.kind
                          ? ` · ${tx.description}`
                          : ""}
                      </div>
                    </div>
                    <div
                      className="font-mono font-semibold text-sm whitespace-nowrap tabular-nums"
                      style={{ color: isPositive ? "#22c55e" : "#f87171" }}
                    >
                      {isPositive ? "+" : "−"}
                      {formatWalletHistoryLzt(amount)} LZT
                    </div>
                  </div>
                );
              })}
            </div>

            {hasMore && (
              <div className="mt-3 text-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs border-white/10 text-slate-300 hover:text-white"
                  style={{ background: "transparent" }}
                  onClick={() => setVisible((v) => v + WALLET_HISTORY_PAGE_SIZE)}
                  data-testid="button-history-more"
                >
                  <ChevronDown className="h-3.5 w-3.5 mr-1.5" />
                  Показать ещё ({filtered.length - visible})
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
