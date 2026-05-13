import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useState } from "react";
import { rpc } from "@/lib/cosmos";
import { defaultNetwork } from "@/data/networks";
import { Card, Badge, Skeleton } from "@/components/shared/ui";
import { formatNumber, shorten } from "@/lib/format";
import { ChevronLeft, ChevronRight, ArrowRightLeft } from "lucide-react";

export const Route = createFileRoute("/transactions")({
  head: () => ({
    meta: [
      { title: "Transactions · Jay Network Explorer" },
      { name: "description", content: "Latest transactions on Jay Network." },
    ],
  }),
  component: TransactionsRouteComponent,
});

function TransactionsRouteComponent() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return path === "/transactions" ? <TransactionsPage /> : <Outlet />;
}

function TransactionsPage() {
  const [page, setPage] = useState(1);

  const { data: status } = useQuery({
    queryKey: ["status"],
    queryFn: () => rpc.status(),
    refetchInterval: defaultNetwork.blockTime * 1000,
    placeholderData: keepPreviousData,
  });
  const tip = Number(status?.result?.sync_info?.latest_block_height ?? 0);

  const { data, isLoading } = useQuery({
    queryKey: ["txs", page],
    queryFn: () => rpc.txSearch(`tx.height>0`, page, 30, "desc"),
    enabled: !!tip,
    refetchInterval: page === 1 ? defaultNetwork.blockTime * 1000 * 2 : false,
    placeholderData: keepPreviousData,
  });

  const txs = (data?.result?.txs ?? []) as any[];
  const total = Number(data?.result?.total_count ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / 30));

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground">
            {total ? `${formatNumber(total)} total transactions` : "Recent activity"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="h-9 w-9 grid place-items-center rounded-lg border border-border hover:bg-accent/40 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-sm text-muted-foreground tabular-nums">
            Page {page} / {totalPages}
          </div>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="h-9 w-9 grid place-items-center rounded-lg border border-border hover:bg-accent/40 disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-5 py-3 font-medium">Hash</th>
                <th className="text-left px-5 py-3 font-medium">Height</th>
                <th className="text-right px-5 py-3 font-medium">Gas</th>
                <th className="text-right px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={4} className="px-5 py-3">
                        <Skeleton className="h-5 w-full" />
                      </td>
                    </tr>
                  ))
                : txs.length === 0
                  ? <tr>
                      <td colSpan={4} className="px-5 py-10 text-center text-muted-foreground">
                        No transactions
                      </td>
                    </tr>
                  : txs.map((tx) => (
                      <tr
                        key={tx.hash}
                        className="border-t border-border hover:bg-accent/30 transition"
                      >
                        <td className="px-5 py-3">
                          <Link
                            to="/transactions/$hash"
                            params={{ hash: tx.hash }}
                            className="text-primary hover:underline font-mono text-xs flex items-center gap-2"
                          >
                            <ArrowRightLeft className="h-3.5 w-3.5" />
                            {shorten(tx.hash, 10, 8)}
                          </Link>
                        </td>
                        <td className="px-5 py-3 font-mono text-xs">
                          <Link
                            to="/blocks/$height"
                            params={{ height: String(tx.height) }}
                            className="hover:text-primary"
                          >
                            #{formatNumber(tx.height)}
                          </Link>
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-xs text-muted-foreground">
                          {formatNumber(tx.tx_result?.gas_used)} /{" "}
                          {formatNumber(tx.tx_result?.gas_wanted)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Badge variant={tx.tx_result?.code ? "destructive" : "success"}>
                            {tx.tx_result?.code ? "Failed" : "Success"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
