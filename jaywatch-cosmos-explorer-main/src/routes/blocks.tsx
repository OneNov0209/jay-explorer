import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { rpc } from "@/lib/cosmos";
import { defaultNetwork } from "@/data/networks";
import { Card, Skeleton } from "@/components/shared/ui";
import { formatNumber, shorten, timeAgo } from "@/lib/format";
import { ChevronLeft, ChevronRight, Boxes, Activity } from "lucide-react";
import { decodeTx } from "@/lib/decodeTx";
import {
  Area,
  Bar,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/blocks")({
  head: () => ({
    meta: [
      { title: "Blocks · Jay Network Explorer" },
      { name: "description", content: "Browse all blocks on Jay Network." },
    ],
  }),
  component: BlocksRouteComponent,
});

const PAGE_SIZE = 50;

function BlocksRouteComponent() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return path === "/blocks" ? <BlocksPage /> : <Outlet />;
}

function BlocksPage() {
  const { data: status } = useQuery({
    queryKey: ["status"],
    queryFn: () => rpc.status(),
    refetchInterval: defaultNetwork.blockTime * 1000,
    placeholderData: keepPreviousData,
  });
  const tip = Number(status?.result?.sync_info?.latest_block_height ?? 0);
  const [page, setPage] = useState(0);
  const max = tip - page * PAGE_SIZE;
  const min = Math.max(1, max - PAGE_SIZE + 1);

  const { data, isLoading } = useQuery({
    queryKey: ["blocks", page, min, max],
    queryFn: () => rpc.blockchain(min, max),
    enabled: !!tip,
    refetchInterval: page === 0 ? defaultNetwork.blockTime * 1000 : false,
    placeholderData: keepPreviousData,
  });
  const blocks = (data?.result?.block_metas ?? []) as any[];
  const [msgType, setMsgType] = useState("all");

  const { data: recentTxs } = useQuery({
    queryKey: ["block-chart-msg-types"],
    queryFn: () => rpc.txSearch("tx.height>0", 1, 100, "desc"),
    refetchInterval: defaultNetwork.blockTime * 1000 * 2,
    placeholderData: keepPreviousData,
  });

  const txMsgStats = useMemo(() => {
    const types = new Set<string>();
    const byHeight = new Map<number, Map<string, number>>();
    for (const tx of recentTxs?.result?.txs ?? []) {
      const decoded = decodeTx(tx.tx);
      const height = Number(tx.height);
      for (const msg of decoded?.messages ?? []) {
        const type = msg.short || msg.typeUrl.split(".").pop() || msg.typeUrl;
        types.add(type);
        const counts = byHeight.get(height) ?? new Map<string, number>();
        counts.set(type, (counts.get(type) ?? 0) + 1);
        byHeight.set(height, counts);
      }
    }
    return { types: Array.from(types).sort(), byHeight };
  }, [recentTxs]);

  const chartData = useMemo(() => {
    return [...blocks]
      .map((b: any, idx, arr) => {
        const prev = arr[idx + 1];
        const dt = prev
          ? (new Date(b.header.time).getTime() - new Date(prev.header.time).getTime()) /
            1000
          : 0;
        const height = Number(b.header.height);
        const typedTxs =
          msgType === "all"
            ? Number(b.num_txs ?? 0)
            : (txMsgStats.byHeight.get(height)?.get(msgType) ?? 0);
        return {
          height,
          txs: Number(b.num_txs ?? 0),
          filteredTxs: typedTxs,
          blockTime: Math.max(0, Number(dt.toFixed(2))),
        };
      })
      .reverse();
  }, [blocks, msgType, txMsgStats]);

  const avgTxs =
    chartData.length > 0
      ? (chartData.reduce((a, c) => a + c.txs, 0) / chartData.length).toFixed(1)
      : "0";
  const avgBT =
    chartData.length > 1
      ? (
          chartData.slice(1).reduce((a, c) => a + c.blockTime, 0) /
          (chartData.length - 1)
        ).toFixed(2)
      : "0";

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Blocks</h1>
          <p className="text-sm text-muted-foreground">
            Latest 50 blocks on {defaultNetwork.displayName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="h-9 w-9 grid place-items-center rounded-lg border border-border hover:bg-accent/40 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-sm text-muted-foreground tabular-nums">
            #{formatNumber(min)} – #{formatNumber(max)}
          </div>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={min <= 1}
            className="h-9 w-9 grid place-items-center rounded-lg border border-border hover:bg-accent/40 disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Activity</h2>
            <span className="text-xs text-muted-foreground">
              tx count & block time across {chartData.length} blocks
            </span>
            {page === 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] text-success ml-1">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
                </span>
                Live
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="inline-flex items-center gap-2 text-muted-foreground">
              Msg type
              <select
                value={msgType}
                onChange={(e) => setMsgType(e.target.value)}
                className="h-8 rounded-md border border-border bg-card px-2 text-foreground focus:border-primary focus:outline-none"
              >
                <option value="all">All txs</option>
                {txMsgStats.types.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </label>
            <span>
              <span className="text-muted-foreground">Avg tx/block: </span>
              <span className="font-mono font-semibold text-primary">{avgTxs}</span>
            </span>
            <span>
              <span className="text-muted-foreground">Avg block time: </span>
              <span className="font-mono font-semibold text-primary">{avgBT}s</span>
            </span>
          </div>
        </div>
        <div className="h-56 w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="bt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                <XAxis
                  dataKey="height"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickFormatter={(v) => `#${v}`}
                  hide
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  width={28}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  width={28}
                />
                <Tooltip
                  cursor={{ fill: "var(--accent)", opacity: 0.15 }}
                  content={<ActivityTooltip msgType={msgType} />}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  height={28}
                  iconType="circle"
                  wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)" }}
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="blockTime"
                  name="Block time (s)"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="url(#bt)"
                  isAnimationActive
                  animationDuration={400}
                />
                <Bar
                  yAxisId="left"
                  dataKey="filteredTxs"
                  name={msgType === "all" ? "Txs" : msgType}
                  fill="var(--chart-3)"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={12}
                  isAnimationActive
                  animationDuration={400}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <Skeleton className="h-full w-full" />
          )}
        </div>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3">
        {isLoading
          ? Array.from({ length: 50 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))
          : blocks.map((b) => (
              <Link
                key={b.header.height}
                to="/blocks/$height"
                params={{ height: String(b.header.height) }}
                className="group relative rounded-xl border border-border bg-card/60 hover:border-primary/50 hover:shadow-glow transition p-3 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-glow opacity-0 group-hover:opacity-100 transition" />
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-primary font-mono text-sm font-semibold">
                    <Boxes className="h-3.5 w-3.5" />
                    #{formatNumber(b.header.height)}
                  </div>
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {b.num_txs} tx
                  </span>
                </div>
                <div className="relative mt-2 font-mono text-[10px] text-muted-foreground truncate">
                  {shorten(b.block_id?.hash, 8, 6)}
                </div>
                <div className="relative mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="truncate font-mono">
                    {shorten(b.header.proposer_address, 6, 4)}
                  </span>
                  <span>{timeAgo(b.header.time)}</span>
                </div>
              </Link>
            ))}
      </div>
    </div>
  );
}

function ActivityTooltip({ active, payload, label, msgType }: any) {
  if (!active || !payload?.length) return null;
  const txs = payload.find((p: any) => p.dataKey === "filteredTxs")?.value ?? 0;
  const bt = payload.find((p: any) => p.dataKey === "blockTime")?.value ?? 0;
  return (
    <div className="rounded-lg border border-border bg-card/95 backdrop-blur px-3 py-2 shadow-lg text-xs">
      <div className="font-semibold mb-1.5 font-mono">Block #{label}</div>
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: "var(--success)" }} />
        <span className="text-muted-foreground">{msgType === "all" ? "Transactions" : msgType}:</span>
        <span className="font-mono font-semibold ml-auto">{txs}</span>
      </div>
      <div className="flex items-center gap-2 mt-1">
        <span className="h-2 w-2 rounded-full" style={{ background: "var(--primary)" }} />
        <span className="text-muted-foreground">Block time:</span>
        <span className="font-mono font-semibold ml-auto">{bt}s</span>
      </div>
    </div>
  );
}


