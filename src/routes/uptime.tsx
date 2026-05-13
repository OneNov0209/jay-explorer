import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { lcd, rpc, safe } from "@/lib/cosmos";
import { defaultNetwork } from "@/data/networks";
import { Card, Badge, Skeleton } from "@/components/shared/ui";
import { ValidatorAvatar, consAddrFromPubkey } from "@/routes/validators";
import { normalizeHex } from "@/lib/bech32";
import { fromBech32, toHex } from "@cosmjs/encoding";
import { shorten } from "@/lib/format";
import {
  Activity,
  Search,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  TrendingUp,
  BarChart3,
  PieChart,
  Gauge,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  ExternalLink,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/uptime")({
  head: () => ({
    meta: [
      { title: "Validators Uptime · Jay Network Explorer" },
      {
        name: "description",
        content:
          "Live PingPub-style uptime dashboard with charts, stats, and detailed validator performance on Jay Network.",
      },
    ],
  }),
  component: UptimePage,
});

const WINDOW_BLOCKS = 50;
const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

function UptimePage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showOnlyLowUptime, setShowOnlyLowUptime] = useState(false);
  const [sortBy, setSortBy] = useState<"rank" | "uptime" | "power">("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedBlock, setSelectedBlock] = useState<{
    moniker?: string;
    h: number;
    sig: "yes" | "no" | "absent";
    time?: string;
  } | null>(null);

  const { data: bonded, isLoading: l1, refetch, isFetching } = useQuery({
    queryKey: ["vals-bonded"],
    queryFn: () => safe(lcd.validatorsAll("BOND_STATUS_BONDED")),
    refetchInterval: 60_000,
  });
  const { data: signing } = useQuery({
    queryKey: ["signing-infos"],
    queryFn: () => safe(lcd.signingInfos()),
    refetchInterval: 30_000,
  });
  const { data: slashingParams } = useQuery({
    queryKey: ["slashing-params"],
    queryFn: () => safe(lcd.slashingParams()),
  });
  const { data: status } = useQuery({
    queryKey: ["rpc-status"],
    queryFn: () => rpc.status(),
    refetchInterval: defaultNetwork.blockTime * 1000,
    placeholderData: keepPreviousData,
  });

  const tip = Number(status?.result?.sync_info?.latest_block_height ?? 0);
  const heights = useMemo(() => {
    if (!tip) return [] as number[];
    return Array.from({ length: WINDOW_BLOCKS }, (_, i) => tip - i).filter((h) => h > 0);
  }, [tip]);

  const { data: blocks } = useQuery({
    queryKey: ["uptime-page-blocks", heights[0] ?? 0],
    queryFn: async () => {
      const res = await Promise.all(heights.map((h) => rpc.block(h).catch(() => null)));
      return res;
    },
    enabled: heights.length > 0,
    refetchInterval: defaultNetwork.blockTime * 2000,
    placeholderData: keepPreviousData,
  });

  const blockSigs = useMemo(() => {
    return (blocks ?? [])
      .filter(Boolean)
      .map((b: any) => ({
        h: Number(b?.result?.block?.header?.height ?? 0),
        time: b?.result?.block?.header?.time as string | undefined,
        sigs: ((b?.result?.block?.last_commit?.signatures ?? []) as any[]).map((s) => ({
          addr: s.validator_address ? normalizeHex(s.validator_address) : "",
          flag: s.block_id_flag,
        })),
      }))
      .sort((a, b) => b.h - a.h);
  }, [blocks]);

  const signMap = useMemo(() => {
    const m = new Map<string, { missed: number }>();
    for (const s of signing?.info ?? []) {
      m.set(s.address, { missed: Number(s.missed_blocks_counter ?? 0) });
    }
    return m;
  }, [signing]);

  const slashingWindow = Number(slashingParams?.params?.signed_blocks_window ?? 10000);

  const allRows = useMemo(() => {
    const all: any[] = (bonded?.validators ?? []) as any[];
    return all
      .map((v: any, index: number) => {
        const valcons = consAddrFromPubkey(v.consensus_pubkey);
        let hexCons: string | null = null;
        try {
          hexCons = valcons ? toHex(fromBech32(valcons).data).toUpperCase() : null;
        } catch {
          hexCons = null;
        }
        const missed: number = valcons ? (signMap.get(valcons)?.missed ?? 0) : 0;
        const uptime = slashingWindow ? Math.max(0, 1 - missed / slashingWindow) : 1;

        const cells = blockSigs.map((b) => {
          const found = hexCons ? b.sigs.find((s) => s.addr === hexCons) : undefined;
          const sig: "yes" | "no" | "absent" = found
            ? found.flag === 2 ||
              found.flag === 3 ||
              found.flag === "BLOCK_ID_FLAG_COMMIT"
              ? "yes"
              : "no"
            : "absent";
          return { h: b.h, sig, time: b.time };
        });

        const signedCount = cells.filter((c) => c.sig === "yes").length;
        const missedCount = cells.filter((c) => c.sig === "no").length;

        return {
          v,
          valcons,
          hexCons,
          missed,
          uptime,
          uptimePct: uptime * 100,
          cells,
          signedCount,
          missedCount,
          rank: index + 1,
        };
      })
      .sort((a: any, b: any) => Number(b.v.tokens) - Number(a.v.tokens))
      .map((row: any, index: number) => ({ ...row, rank: index + 1 }));
  }, [bonded, signMap, blockSigs, slashingWindow]);

  const filtered = useMemo(() => {
    let result = [...allRows];
    if (q) {
      const ql = q.toLowerCase();
      result = result.filter(
        (row: any) =>
          row.v.description?.moniker?.toLowerCase().includes(ql) ||
          row.v.operator_address?.toLowerCase().includes(ql),
      );
    }
    if (showOnlyLowUptime) {
      result = result.filter((row: any) => row.uptimePct < 95);
    }
    result.sort((a: any, b: any) => {
      let cmp = 0;
      if (sortBy === "rank") cmp = a.rank - b.rank;
      else if (sortBy === "uptime") cmp = a.uptimePct - b.uptimePct;
      else if (sortBy === "power") cmp = Number(b.v.tokens) - Number(a.v.tokens);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [allRows, q, showOnlyLowUptime, sortBy, sortDir]);

  const avgUptime =
    allRows.length > 0
      ? (allRows.reduce((s: number, r: any) => s + r.uptimePct, 0) / allRows.length).toFixed(1)
      : "—";

  const healthyCount = allRows.filter((r: any) => r.uptimePct >= 95).length;
  const warningCount = allRows.filter((r: any) => r.uptimePct >= 80 && r.uptimePct < 95).length;
  const dangerCount = allRows.filter((r: any) => r.uptimePct < 80).length;

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedRows = useMemo(
    () => filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filtered, safePage, pageSize],
  );

  const toggleRow = (addr: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(addr) ? next.delete(addr) : next.add(addr);
      return next;
    });
  };

  const handleSort = (type: "rank" | "uptime" | "power") => {
    if (sortBy === type) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(type);
      setSortDir(type === "uptime" ? "desc" : "asc");
    }
    setPage(1);
  };

  const chartData = useMemo(() => {
    return allRows.slice(0, 20).map((row: any) => ({
      name: (row.v.description?.moniker || shorten(row.v.operator_address)).slice(0, 10),
      uptime: row.uptimePct,
    }));
  }, [allRows]);

  if (l1) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" /> Validators Uptime
          </h1>
          <p className="text-sm text-muted-foreground">
            Live signing performance · last {WINDOW_BLOCKS} blocks · refresh ~
            {defaultNetwork.blockTime * 2}s
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="btn-3d bg-gradient-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Refresh Data
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Active Validators"
          value={allRows.length}
          icon={<Activity className="h-5 w-5" />}
          gradient="from-primary/10 via-primary/5 to-transparent"
        />
        <StatCard
          label="Blocks Tracked"
          value={WINDOW_BLOCKS}
          icon={<BarChart3 className="h-5 w-5" />}
          gradient="from-accent/10 via-accent/5 to-transparent"
        />
        <StatCard
          label="Avg Uptime"
          value={`${avgUptime}%`}
          icon={<Gauge className="h-5 w-5" />}
          gradient="from-emerald-500/10 via-emerald-500/5 to-transparent"
          trend={parseFloat(avgUptime)}
        />
        <StatCard
          label="Height"
          value={`#${tip.toLocaleString()}`}
          icon={<TrendingUp className="h-5 w-5" />}
          gradient="from-purple-500/10 via-purple-500/5 to-transparent"
        />
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="card-3d p-5 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Top 20 Validator Uptime</h2>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="uptimeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} unit="%" />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="uptime"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fill="url(#uptimeGradient)"
                  name="Uptime %"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="card-3d p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <PieChart className="h-5 w-5 text-primary" />
            Network Health
          </h2>
          <div className="space-y-4">
            <HealthBar
              label="≥95%"
              count={healthyCount}
              total={allRows.length}
              color="bg-emerald-500"
            />
            <HealthBar
              label="80-95%"
              count={warningCount}
              total={allRows.length}
              color="bg-yellow-500"
            />
            <HealthBar
              label="<80%"
              count={dangerCount}
              total={allRows.length}
              color="bg-red-500"
            />
          </div>
        </Card>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search validators by moniker or address"
            className="w-full pl-10 pr-3 h-10 text-sm rounded-lg bg-card border border-border focus:border-primary focus:outline-none"
          />
        </div>
        <button
          onClick={() => setShowOnlyLowUptime(!showOnlyLowUptime)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
            showOnlyLowUptime
              ? "bg-yellow-500/20 text-yellow-600 border border-yellow-500/30"
              : "bg-card border border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          {showOnlyLowUptime ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          Low Uptime Only
        </button>
      </div>

      {/* Pagination Top */}
      <PaginationBar
        total={filtered.length}
        page={page}
        pageSize={pageSize}
        onPage={setPage}
        onPageSize={(s) => {
          setPageSize(s);
          setPage(1);
        }}
      />

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr className="border-b border-border">
                <th
                  className="text-left p-4 text-muted-foreground font-medium w-12 cursor-pointer hover:text-primary"
                  onClick={() => handleSort("rank")}
                >
                  # {sortBy === "rank" && (sortDir === "asc" ? "↑" : "↓")}
                </th>
                <th className="text-left p-4 text-muted-foreground font-medium">Validator</th>
                <th className="text-left p-4 text-muted-foreground font-medium">
                  Last {WINDOW_BLOCKS} Blocks
                </th>
                <th className="text-right p-4 text-muted-foreground font-medium">Missed</th>
                <th className="text-center p-4 text-muted-foreground font-medium">Status</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-muted-foreground text-sm">
                    No validators found
                  </td>
                </tr>
              ) : (
                pagedRows.map((row: any, i: number) => {
                  const isExpanded = expandedRows.has(row.v.operator_address);
                  const isGood = row.uptimePct >= 95;
                  const isWarning = row.uptimePct >= 80 && row.uptimePct < 95;

                  return (
                    <>
                      <tr
                        key={row.v.operator_address}
                        className={`border-b border-border/40 transition ${
                          isGood
                            ? "hover:bg-emerald-500/5"
                            : isWarning
                              ? "bg-yellow-500/5 hover:bg-yellow-500/10 border-l-4 border-l-yellow-500"
                              : "bg-red-500/5 hover:bg-red-500/10 border-l-4 border-l-red-500"
                        } ${i % 2 === 0 ? "bg-secondary/5" : ""}`}
                      >
                        <td className="p-4 text-muted-foreground font-mono text-xs font-bold">
                          #{row.rank}
                        </td>
                        <td className="p-4">
                          <Link
                            to="/validators/$address"
                            params={{ address: row.v.operator_address }}
                            className="flex items-center gap-3 hover:text-primary transition"
                          >
                            <ValidatorAvatar
                              identity={row.v.description?.identity}
                              moniker={row.v.description?.moniker}
                              size={36}
                            />
                            <div>
                              <span className="font-medium block">
                                {row.v.description?.moniker || shorten(row.v.operator_address)}
                              </span>
                              <span className="text-[11px] text-muted-foreground font-mono">
                                {shorten(row.v.operator_address, 10, 6)}
                              </span>
                            </div>
                          </Link>
                        </td>
                        <td className="p-4">
                          <div className="flex gap-[2px]">
                            {row.cells.map((c: any) => (
                              <button
                                key={c.h}
                                type="button"
                                onClick={() =>
                                  setSelectedBlock({
                                    moniker: row.v.description?.moniker,
                                    h: c.h,
                                    sig: c.sig,
                                    time: c.time,
                                  })
                                }
                                title={`Block #${c.h.toLocaleString()} — ${
                                  c.sig === "yes"
                                    ? "Signed"
                                    : c.sig === "no"
                                      ? "Missed"
                                      : "Absent"
                                }`}
                                className={`h-5 w-[6px] rounded-sm transition cursor-pointer hover:scale-150 hover:z-10 ${
                                  c.sig === "yes"
                                    ? "bg-emerald-500 hover:bg-emerald-400"
                                    : c.sig === "no"
                                      ? "bg-yellow-500 hover:bg-yellow-400"
                                      : "bg-red-500 hover:bg-red-400"
                                }`}
                              />
                            ))}
                          </div>
                        </td>
                        <td className="p-4 text-right font-mono text-xs text-red-500 font-bold">
                          {row.missedCount}
                        </td>
                        <td className="p-4 text-center">
                          {isGood ? (
                            <CheckCircle className="h-5 w-5 text-emerald-500 inline" />
                          ) : isWarning ? (
                            <AlertTriangle className="h-5 w-5 text-yellow-500 inline" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500 inline" />
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => toggleRow(row.v.operator_address)}
                            className="text-muted-foreground hover:text-primary transition"
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-secondary/10 border-b border-border/20">
                          <td colSpan={6} className="p-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              <div className="p-3 rounded-lg bg-card/50">
                                <p className="text-[11px] text-muted-foreground">Commission</p>
                                <p className="text-sm font-semibold">
                                  {(
                                    Number(row.v.commission?.commission_rates?.rate ?? 0) * 100
                                  ).toFixed(1)}
                                  %
                                </p>
                              </div>
                              <div className="p-3 rounded-lg bg-card/50">
                                <p className="text-[11px] text-muted-foreground">Signed Blocks</p>
                                <p className="text-sm font-semibold text-emerald-500">
                                  {row.signedCount}
                                </p>
                              </div>
                              <div className="p-3 rounded-lg bg-card/50">
                                <p className="text-[11px] text-muted-foreground">Missed Blocks</p>
                                <p className="text-sm font-semibold text-red-500">
                                  {row.missedCount}
                                </p>
                              </div>
                              <div className="p-3 rounded-lg bg-card/50">
                                <p className="text-[11px] text-muted-foreground">
                                  Slashing Window Missed
                                </p>
                                <p className="text-sm font-semibold">{row.missed.toLocaleString()}</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-border text-xs text-muted-foreground text-center">
          🟩 Signed · 🟨 Missed · 🟥 Absent · Click any block for details · Uptime from {slashingWindow.toLocaleString()} blocks
        </div>
      </Card>

      {/* Block Detail Dialog */}
      <Dialog open={!!selectedBlock} onOpenChange={(o) => !o && setSelectedBlock(null)}>
        {selectedBlock && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                Block #{selectedBlock.h.toLocaleString()}
                <Badge
                  variant={
                    selectedBlock.sig === "yes"
                      ? "success"
                      : selectedBlock.sig === "no"
                        ? "warning"
                        : "destructive"
                  }
                >
                  {selectedBlock.sig === "yes"
                    ? "Signed"
                    : selectedBlock.sig === "no"
                      ? "Missed"
                      : "Absent"}
                </Badge>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-xs uppercase text-muted-foreground">Validator</div>
                <div className="font-medium">{selectedBlock.moniker}</div>
              </div>
              {selectedBlock.time && (
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Time</div>
                  <div className="font-mono text-xs">
                    {new Date(selectedBlock.time).toLocaleString()}
                  </div>
                </div>
              )}
              <div className="pt-2 border-t border-border flex justify-end">
                <Link
                  to="/blocks/$height"
                  params={{ height: String(selectedBlock.h) }}
                  className="text-primary text-sm hover:underline inline-flex items-center gap-1"
                  onClick={() => setSelectedBlock(null)}
                >
                  Open block <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  gradient,
  trend,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  gradient: string;
  trend?: number;
}) {
  return (
    <Card className={`card-3d p-4 bg-gradient-to-br ${gradient} border-primary/10`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="text-primary/70">{icon}</span>
      </div>
      <div className="text-xl font-bold">{value}</div>
      {trend !== undefined && (
        <div className={`text-xs mt-1 ${trend >= 95 ? "text-emerald-500" : trend >= 80 ? "text-yellow-500" : "text-red-500"}`}>
          {trend >= 95 ? "Healthy" : trend >= 80 ? "Warning" : "Critical"}
        </div>
      )}
    </Card>
  );
}

function HealthBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{count}</span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function PaginationBar({
  total,
  page,
  pageSize,
  onPage,
  onPageSize,
}: {
  total: number;
  page: number;
  pageSize: number;
  onPage: (p: number) => void;
  onPageSize: (s: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);

  return (
    <Card className="p-3 flex flex-col sm:flex-row gap-3 sm:items-center justify-between text-xs">
      <div className="text-muted-foreground">
        Showing{" "}
        <span className="font-mono text-foreground">
          {start}-{end}
        </span>{" "}
        of <span className="font-mono text-foreground">{total.toLocaleString()}</span> validators
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">Per page</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSize(Number(e.target.value))}
          className="h-8 px-2 rounded-md bg-card border border-border text-xs focus:outline-none focus:border-primary"
        >
          {PAGE_SIZE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1 ml-2">
          <button
            type="button"
            onClick={() => onPage(1)}
            disabled={safePage <= 1}
            className="h-8 px-2 rounded-md border border-border bg-card disabled:opacity-40 hover:bg-muted transition"
          >
            «
          </button>
          <button
            type="button"
            onClick={() => onPage(safePage - 1)}
            disabled={safePage <= 1}
            className="h-8 px-2 rounded-md border border-border bg-card disabled:opacity-40 hover:bg-muted transition"
          >
            ‹
          </button>
          <span className="px-2 font-mono">
            {safePage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPage(safePage + 1)}
            disabled={safePage >= totalPages}
            className="h-8 px-2 rounded-md border border-border bg-card disabled:opacity-40 hover:bg-muted transition"
          >
            ›
          </button>
          <button
            type="button"
            onClick={() => onPage(totalPages)}
            disabled={safePage >= totalPages}
            className="h-8 px-2 rounded-md border border-border bg-card disabled:opacity-40 hover:bg-muted transition"
          >
            »
          </button>
        </div>
      </div>
    </Card>
  );
}
