import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { rpc } from "@/lib/cosmos";
import { defaultNetwork } from "@/data/networks";
import { Card, Badge, Skeleton } from "@/components/shared/ui";
import { formatNumber, shorten } from "@/lib/format";
import {
  ChevronLeft,
  ChevronRight,
  ArrowRightLeft,
  Activity,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  Cell,
} from "recharts";

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

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

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

  // Chart data: TX count per block for the current page
  const chartData = useMemo(() => {
    const blockMap = new Map<number, { height: number; count: number; failed: number }>();
    for (const tx of txs) {
      const h = Number(tx.height);
      const entry = blockMap.get(h) || { height: h, count: 0, failed: 0 };
      entry.count++;
      if (tx.tx_result?.code) entry.failed++;
      blockMap.set(h, entry);
    }
    return [...blockMap.values()]
      .sort((a, b) => b.height - a.height)
      .reverse();
  }, [txs]);

  // Stats
  const totalTx = txs.length;
  const successTx = txs.filter((tx) => !tx.tx_result?.code).length;
  const failedTx = txs.filter((tx) => tx.tx_result?.code).length;
  const avgGas =
    totalTx > 0
      ? Math.round(
          txs.reduce((s, tx) => s + Number(tx.tx_result?.gas_used ?? 0), 0) / totalTx,
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
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

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total TXs"
          value={formatNumber(totalTx)}
          icon={<Activity className="h-4 w-4" />}
          gradient="from-primary/10 via-primary/5 to-transparent"
        />
        <StatCard
          label="Success"
          value={formatNumber(successTx)}
          icon={<TrendingUp className="h-4 w-4" />}
          gradient="from-emerald-500/10 via-emerald-500/5 to-transparent"
        />
        <StatCard
          label="Failed"
          value={formatNumber(failedTx)}
          icon={<Activity className="h-4 w-4" />}
          gradient="from-red-500/10 via-red-500/5 to-transparent"
        />
        <StatCard
          label="Avg Gas"
          value={formatNumber(avgGas)}
          icon={<BarChart3 className="h-4 w-4" />}
          gradient="from-violet-500/10 via-violet-500/5 to-transparent"
        />
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card className="card-3d p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Transactions per Block
            </h2>
            <span className="text-xs text-muted-foreground">
              Last {chartData.length} blocks
            </span>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBarChart
                data={chartData}
                margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  opacity={0.3}
                  vertical={false}
                />
                <XAxis
                  dataKey="height"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickFormatter={(v) => `#${v}`}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: any, name: string) => [
                    value,
                    name === "count" ? "Total TXs" : "Failed",
                  ]}
                  labelFormatter={(label) => `Block #${label}`}
                />
                <Bar
                  dataKey="count"
                  name="count"
                  fill="var(--chart-1)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={20}
                />
                <Bar
                  dataKey="failed"
                  name="failed"
                  fill="var(--destructive)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={20}
                />
              </RechartsBarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[var(--chart-1)]" /> Total TXs
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[var(--destructive)]" /> Failed
            </span>
          </div>
        </Card>
      )}

      {/* Table */}
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
                  ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-10 text-center text-muted-foreground">
                        No transactions
                      </td>
                    </tr>
                  )
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
                          <Badge
                            variant={tx.tx_result?.code ? "destructive" : "success"}
                          >
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

function StatCard({
  label,
  value,
  icon,
  gradient,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  gradient: string;
}) {
  return (
    <Card className={`card-3d p-4 bg-gradient-to-br ${gradient} border-primary/10`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="text-primary/70">{icon}</span>
      </div>
      <div className="text-xl font-bold">{value}</div>
    </Card>
  );
}
