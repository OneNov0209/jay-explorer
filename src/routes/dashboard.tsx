import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { rpc, lcd, safe } from "@/lib/cosmos";
import { defaultNetwork } from "@/data/networks";
import { Card, StatCard, Skeleton, Badge } from "@/components/shared/ui";
import { CopyButton } from "@/components/shared/CopyButton";
import { formatAmount, formatNumber, shorten, timeAgo, pct } from "@/lib/format";
import {
  Boxes,
  Shield,
  ArrowRightLeft,
  Coins,
  Flame,
  TrendingUp,
  PiggyBank,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · Jay Network Explorer" },
      {
        name: "description",
        content:
          "Live chain summary, supply, validators, and analytics charts for Jay Network.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: status } = useQuery({
    queryKey: ["status"],
    queryFn: () => rpc.status(),
    refetchInterval: defaultNetwork.blockTime * 1000,
    placeholderData: keepPreviousData,
  });
  const height = Number(status?.result?.sync_info?.latest_block_height ?? 0);

  const { data: validators } = useQuery({
    queryKey: ["validators-rpc"],
    queryFn: () => rpc.validators(undefined, 1, 200),
    enabled: !!height,
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });
  const { data: validatorsAll } = useQuery({
    queryKey: ["validators-all-dash"],
    queryFn: () => safe(lcd.validatorsAll()),
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });
  const { data: pool } = useQuery({
    queryKey: ["pool"],
    queryFn: () => safe(lcd.pool()),
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });
  const { data: supply } = useQuery({
    queryKey: ["supply"],
    queryFn: () => safe(lcd.supply()),
    refetchInterval: 120_000,
    placeholderData: keepPreviousData,
  });
  const { data: inflation } = useQuery({
    queryKey: ["inflation-dash"],
    queryFn: () => safe(lcd.inflation()),
    refetchInterval: 300_000,
  });
  const { data: annual } = useQuery({
    queryKey: ["annual-dash"],
    queryFn: () => safe(lcd.annualProvisions()),
    refetchInterval: 300_000,
  });

  const { data: blocksData } = useQuery({
    queryKey: ["latest-blocks"],
    queryFn: async () => {
      const s = await rpc.status();
      const tip = Number(s?.result?.sync_info?.latest_block_height ?? 0);
      if (!tip) return [];
      const min = Math.max(1, tip - 49);
      const r = await rpc.blockchain(min, tip);
      return ((r?.result?.block_metas ?? []) as any[]).reverse();
    },
    refetchInterval: defaultNetwork.blockTime * 1000,
    placeholderData: keepPreviousData,
  });

  const { data: latestTxs } = useQuery({
    queryKey: ["latest-txs"],
    queryFn: async () => {
      const s = await rpc.status();
      const tip = Number(s?.result?.sync_info?.latest_block_height ?? 0);
      if (!tip) return [];
      const r = await rpc.txSearch(`tx.height>${Math.max(1, tip - 200)}`, 1, 10, "desc");
      return (r?.result?.txs ?? []) as any[];
    },
    refetchInterval: defaultNetwork.blockTime * 1000 * 2,
    placeholderData: keepPreviousData,
  });

  const bondedTotal = pool?.pool?.bonded_tokens;
  const totalSupplyAmt = supply?.supply?.find((s: any) => s.denom === defaultNetwork.denom)?.amount;
  const totalSupply = Number(totalSupplyAmt ?? 0);
  const bonded = Number(bondedTotal ?? 0);
  const bondRatio = totalSupply ? bonded / totalSupply : 0;
  const activeVals = validators?.result?.validators?.length ?? 0;
  const inflationRate = Number(inflation?.inflation ?? 0);
  const annualProv = Number(annual?.annual_provisions ?? 0);
  const apr = bonded ? annualProv / bonded : 0;

  const blockSeries = (blocksData ?? []).map((b: any, i: number) => {
    const prev = (blocksData ?? [])[i - 1];
    const t = new Date(b.header.time).getTime();
    const pt = prev ? new Date(prev.header.time).getTime() : t;
    return {
      h: Number(b.header.height),
      txs: Number(b.num_txs ?? 0),
      time: Math.max(0, (t - pt) / 1000),
    };
  });

  const top10 = (validatorsAll?.validators ?? [])
    .slice()
    .sort((a: any, b: any) => Number(b.tokens) - Number(a.tokens))
    .slice(0, 10)
    .map((v: any) => ({
      moniker: (v.description?.moniker ?? "").slice(0, 14),
      power: Number(v.tokens) / 10 ** defaultNetwork.tokenDecimals,
    }));

  const tokenomics = [
    { name: "Bonded", value: bonded, color: "var(--chart-1)" },
    { name: "Available", value: Math.max(0, totalSupply - bonded), color: "var(--chart-5)" },
  ];
  const BAR_PALETTE = [
    "var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)",
    "var(--chart-5)", "var(--chart-6)", "var(--chart-1)", "var(--chart-2)",
    "var(--chart-3)", "var(--chart-4)",
  ];

  return (
    <div className="space-y-8">
      <div>
        <Badge variant="muted">Dashboard</Badge>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          {defaultNetwork.displayName} Overview
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Live chain summary · {defaultNetwork.chainId}
        </p>
      </div>

      {/* CHAIN STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Block Height"
          value={height ? `#${formatNumber(height)}` : "—"}
          hint={`~${defaultNetwork.blockTime}s block time`}
          icon={<Boxes className="h-4 w-4" />}
          accent
        />
        <StatCard
          label="Active Validators"
          value={activeVals || "—"}
          hint="Bonded set"
          icon={<Shield className="h-4 w-4" />}
        />
        <StatCard
          label="Bonded Ratio"
          value={bondRatio ? pct(bondRatio, 2) : "—"}
          hint={bondedTotal ? formatAmount(bondedTotal) + " staked" : ""}
          icon={<Coins className="h-4 w-4" />}
        />
        <StatCard
          label="Total Supply"
          value={totalSupplyAmt ? formatAmount(totalSupplyAmt, { precision: 0 }) : "—"}
          hint={`Denom: ${defaultNetwork.denom}`}
          icon={<ArrowRightLeft className="h-4 w-4" />}
        />
      </div>

      {/* SUPPLY STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Bonded"
          value={formatAmount(bonded, { precision: 0 })}
          hint={pct(bondRatio, 2) + " of supply"}
          icon={<PiggyBank className="h-4 w-4" />}
        />
        <StatCard
          label="Inflation"
          value={pct(inflationRate, 2)}
          hint="Current annual"
          icon={<Flame className="h-4 w-4" />}
        />
        <StatCard
          label="Staking APR"
          value={pct(apr, 2)}
          hint="Estimated nominal"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="Coin Denom"
          value={defaultNetwork.coinDenom}
          hint={defaultNetwork.denom}
          icon={<Coins className="h-4 w-4" />}
        />
      </div>

      {/* CHARTS */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h2 className="font-semibold mb-3">Block Time (last 50)</h2>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={blockSeries}>
              <defs>
                <linearGradient id="bt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="h" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area type="monotone" dataKey="time" stroke="var(--chart-1)" fill="url(#bt)" name="Seconds" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold mb-3">Transactions per Block</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={blockSeries}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="h" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="txs" radius={[4, 4, 0, 0]}>
                {blockSeries.map((_: any, i: number) => (
                  <Cell key={i} fill={BAR_PALETTE[i % BAR_PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold mb-3">Top 10 Validators by Voting Power</h2>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={top10} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis dataKey="moniker" type="category" tick={{ fontSize: 10 }} width={90} />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="power" radius={[0, 4, 4, 0]}>
                {top10.map((_: any, i: number) => (
                  <Cell key={i} fill={BAR_PALETTE[i % BAR_PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold mb-3">Tokenomics</h2>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={tokenomics}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
              >
                {tokenomics.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 grid grid-cols-3 gap-3 text-center text-xs">
            <div>
              <div className="text-muted-foreground">Inflation</div>
              <div className="font-bold text-foreground">{pct(inflationRate, 2)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Bonded</div>
              <div className="font-bold text-foreground">
                {totalSupply ? pct(bonded / totalSupply, 2) : "—"}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Validators</div>
              <div className="font-bold text-foreground">
                {formatNumber(validatorsAll?.validators?.length ?? 0)}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* LATEST BLOCKS + TXS */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold">Latest Blocks</h2>
            <Link to="/blocks" className="text-xs text-primary hover:underline">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-border">
            {!blocksData
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="px-5 py-3">
                    <Skeleton className="h-4 w-full" />
                  </div>
                ))
              : blocksData.slice(0, 8).map((b: any) => {
                  const h = b.header.height;
                  return (
                    <Link
                      key={h}
                      to="/blocks/$height"
                      params={{ height: String(h) }}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-accent/30 transition"
                    >
                      <div className="h-9 w-9 rounded-lg bg-primary/15 grid place-items-center text-primary">
                        <Boxes className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium font-mono">#{formatNumber(h)}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          Proposer {shorten(b.header.proposer_address, 6, 4)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs">{b.num_txs} txs</div>
                        <div className="text-[11px] text-muted-foreground">
                          {timeAgo(b.header.time)}
                        </div>
                      </div>
                    </Link>
                  );
                })}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold">Latest Transactions</h2>
            <Link to="/transactions" className="text-xs text-primary hover:underline">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-border">
            {!latestTxs ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="px-5 py-3">
                  <Skeleton className="h-4 w-full" />
                </div>
              ))
            ) : latestTxs.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                No recent transactions
              </div>
            ) : (
              latestTxs.map((tx: any) => (
                <Link
                  key={tx.hash}
                  to="/transactions/$hash"
                  params={{ hash: tx.hash }}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-accent/30 transition"
                >
                  <div className="h-9 w-9 rounded-lg bg-primary/15 grid place-items-center text-primary">
                    <ArrowRightLeft className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-mono truncate">
                      {shorten(tx.hash, 10, 8)}
                      <CopyButton value={tx.hash} className="ml-1 inline-flex" />
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Block #{formatNumber(tx.height)}
                    </div>
                  </div>
                  <Badge variant={tx.tx_result?.code ? "destructive" : "success"}>
                    {tx.tx_result?.code ? "Failed" : "Success"}
                  </Badge>
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>

      <NodeInfoSection />
    </div>
  );
}

function PPRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr className="border-b border-border/60 last:border-0 align-top">
      <td className="w-[180px] md:w-[220px] py-3 px-4 text-mono text-sm text-muted-foreground bg-muted/20">
        {label}
      </td>
      <td className="py-3 px-4 text-mono text-sm break-all">{children}</td>
    </tr>
  );
}

function NestedTable({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  return (
    <table className="w-full border-collapse">
      <tbody>
        {rows.map(([k, v], i) => (
          <tr key={i} className="border-b border-border/60 last:border-0">
            <td className="w-[160px] py-2 px-4 text-mono text-sm text-muted-foreground">{k}</td>
            <td className="py-2 px-4 text-mono text-sm break-all">{v ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function NodeInfoSection() {
  const { data: nodeInfo } = useQuery({
    queryKey: ["dash-node-info"],
    queryFn: () => safe(lcd.nodeInfo()),
    refetchInterval: 15_000,
    placeholderData: keepPreviousData,
  });

  const dni = (nodeInfo as any)?.default_node_info ?? {};
  const av = (nodeInfo as any)?.application_version ?? {};
  const pv = dni.protocol_version ?? {};
  const other = dni.other ?? {};
  const deps: any[] = Array.isArray(av.build_deps) ? av.build_deps : [];

  return (
    <div className="space-y-6 mt-2">
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60 flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse-dot" />
          <h2 className="font-semibold text-lg">Application Versions</h2>
        </div>
        <table className="w-full border-collapse">
          <tbody>
            <PPRow label="name">{av.name || "—"}</PPRow>
            <PPRow label="app_name">{av.app_name || "—"}</PPRow>
            <PPRow label="version">
              {av.version ? <Badge variant="success">{av.version}</Badge> : "—"}
            </PPRow>
            <PPRow label="git_commit">
              {av.git_commit ? (
                <span className="inline-flex items-center gap-2">
                  {av.git_commit}
                  <CopyButton value={av.git_commit} />
                </span>
              ) : "—"}
            </PPRow>
            <PPRow label="build_tags">{av.build_tags || "—"}</PPRow>
            <PPRow label="go_version">{av.go_version || "—"}</PPRow>
            {av.cosmos_sdk_version && (
              <PPRow label="cosmos_sdk_version">
                <Badge variant="muted">{av.cosmos_sdk_version}</Badge>
              </PPRow>
            )}
            {deps.length > 0 && (
              <PPRow label="build_deps">
                <div className="-mx-4 -my-3 max-h-80 overflow-auto">
                  <table className="w-full border-collapse">
                    <thead className="sticky top-0 bg-muted/40">
                      <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="py-2 px-4 font-normal">Path</th>
                        <th className="py-2 px-4 font-normal w-[120px]">Version</th>
                        <th className="py-2 px-4 font-normal">Sum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deps.map((d: any, i: number) => {
                        if (typeof d === "string") {
                          const parts = d.split(/\s+/);
                          return (
                            <tr key={i} className="border-t border-border/40">
                              <td className="py-1.5 px-4">{parts[0]}</td>
                              <td className="py-1.5 px-4">{parts[1] ?? ""}</td>
                              <td className="py-1.5 px-4 break-all">{parts[2] ?? ""}</td>
                            </tr>
                          );
                        }
                        return (
                          <tr key={i} className="border-t border-border/40">
                            <td className="py-1.5 px-4">{d.path}</td>
                            <td className="py-1.5 px-4">{d.version}</td>
                            <td className="py-1.5 px-4 break-all">{d.sum}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </PPRow>
            )}
          </tbody>
        </table>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60 flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse-dot" />
          <h2 className="font-semibold text-lg">Node Information</h2>
        </div>
        <table className="w-full border-collapse">
          <tbody>
            <PPRow label="protocol_version">
              <div className="-mx-4 -my-3">
                <NestedTable
                  rows={[
                    ["P2p", pv.p2p ?? "—"],
                    ["Block", pv.block ?? "—"],
                    ["App", pv.app ?? "—"],
                  ]}
                />
              </div>
            </PPRow>
            <PPRow label="default_node_id">
              {dni.default_node_id ? (
                <span className="inline-flex items-center gap-2">
                  {dni.default_node_id}
                  <CopyButton value={dni.default_node_id} />
                </span>
              ) : "—"}
            </PPRow>
            <PPRow label="listen_addr">{dni.listen_addr || "—"}</PPRow>
            <PPRow label="network">
              {dni.network ? <Badge variant="success">{dni.network}</Badge> : "—"}
            </PPRow>
            <PPRow label="version">{dni.version || "—"}</PPRow>
            <PPRow label="channels">{dni.channels || "—"}</PPRow>
            <PPRow label="moniker">{dni.moniker || "—"}</PPRow>
            <PPRow label="other">
              <div className="-mx-4 -my-3">
                <NestedTable
                  rows={[
                    ["Tx Index", other.tx_index ?? "—"],
                    ["Rpc Address", other.rpc_address ?? "—"],
                  ]}
                />
              </div>
            </PPRow>
          </tbody>
        </table>
      </Card>
    </div>
  );
}

