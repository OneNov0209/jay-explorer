import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueries } from "@tanstack/react-query";
import { lcd, rpc, safe } from "@/lib/cosmos";
import { Card, Skeleton, Badge } from "@/components/shared/ui";
import { CopyButton } from "@/components/shared/CopyButton";
import { formatAmount, shorten, timeAgo } from "@/lib/format";
import { defaultNetwork } from "@/data/networks";
import { Wallet, Send, Coins, ArrowDownLeft, ArrowUpRight, Layers } from "lucide-react";
import { useMemo, useState } from "react";
import { useWallet } from "@/lib/wallet";
import { TransactionModal } from "@/components/tx/TransactionModal";
import { ClaimDialog } from "@/components/tx/VoteClaimDialogs";
import { ValidatorAvatar } from "@/routes/validators";
import { decodeTx } from "@/lib/decodeTx";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/accounts/$address")({
  head: ({ params }) => ({
    meta: [{ title: `Account ${params.address.slice(0, 16)}… · Jay Network Explorer` }],
  }),
  component: AccountPage,
});

const PIE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];

function AccountPage() {
  const { address } = Route.useParams();
  const { address: wallet, connect } = useWallet();
  const [sendOpen, setSendOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const isOwn = wallet === address;

  const { data: balance, isLoading } = useQuery({
    queryKey: ["bal", address],
    queryFn: () => safe(lcd.balance(address)),
    refetchInterval: 30_000,
  });
  const { data: dels } = useQuery({
    queryKey: ["dels", address],
    queryFn: () => safe(lcd.delegations(address)),
    refetchInterval: 30_000,
  });
  const { data: rewards } = useQuery({
    queryKey: ["rewards", address],
    queryFn: () => safe(lcd.rewards(address)),
    refetchInterval: 30_000,
  });
  const { data: unb } = useQuery({
    queryKey: ["unb", address],
    queryFn: () => safe(lcd.unbondings(address)),
    refetchInterval: 30_000,
  });

  const isVal = address.startsWith(defaultNetwork.bech32Config.bech32PrefixValAddr);
  const available = Number(
    balance?.balances?.find((b: any) => b.denom === defaultNetwork.denom)?.amount ?? 0,
  );
  const delegations = dels?.delegation_responses ?? [];
  const delegated = delegations.reduce(
    (s: number, d: any) => s + Number(d.balance?.amount ?? 0),
    0,
  );
  const totalRewards = Number(
    rewards?.total?.find((t: any) => t.denom === defaultNetwork.denom)?.amount ?? 0,
  );
  const unbonding = (unb?.unbonding_responses ?? []).reduce(
    (s: number, u: any) =>
      s + (u.entries ?? []).reduce((ss: number, e: any) => ss + Number(e.balance ?? 0), 0),
    0,
  );

  // Fetch validator info for each delegation in parallel
  const valQueries = useQueries({
    queries: delegations.map((d: any) => ({
      queryKey: ["val-meta", d.delegation.validator_address],
      queryFn: () => safe(lcd.validator(d.delegation.validator_address)),
      staleTime: 5 * 60_000,
    })),
  });

  type DelRow = {
    valoper: string;
    amount: number;
    shares: number;
    moniker?: string;
    identity?: string;
    jailed?: boolean;
    status?: string;
  };
  const enrichedDels: DelRow[] = useMemo(
    () =>
      delegations.map((d: any, i: number) => {
        const v = (valQueries[i]?.data as any)?.validator;
        return {
          valoper: d.delegation.validator_address,
          amount: Number(d.balance?.amount ?? 0),
          shares: Number(d.delegation?.shares ?? 0),
          moniker: v?.description?.moniker,
          identity: v?.description?.identity,
          jailed: v?.jailed,
          status: v?.status,
        };
      }),
    [delegations, valQueries],
  );

  // Recent transactions via Tendermint tx_search
  const { data: txSent } = useQuery({
    queryKey: ["tx-sent", address],
    queryFn: () => safe(rpc.txSearch(`message.sender='${address}'`, 1, 25, "desc")),
    refetchInterval: 30_000,
  });
  const { data: txRecv } = useQuery({
    queryKey: ["tx-recv", address],
    queryFn: () => safe(rpc.txSearch(`transfer.recipient='${address}'`, 1, 25, "desc")),
    refetchInterval: 30_000,
  });

  const recentTxs = useMemo(() => {
    const all = [
      ...((txSent as any)?.result?.txs ?? []).map((t: any) => ({ ...t, _dir: "out" as const })),
      ...((txRecv as any)?.result?.txs ?? []).map((t: any) => ({ ...t, _dir: "in" as const })),
    ];
    const seen = new Set<string>();
    const dedup = all.filter((t) => {
      if (seen.has(t.hash)) return false;
      seen.add(t.hash);
      return true;
    });
    dedup.sort((a, b) => Number(b.height) - Number(a.height));
    return dedup.slice(0, 30);
  }, [txSent, txRecv]);

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  const totalPortfolio = available + delegated + unbonding + totalRewards;
  const pieData = [
    { name: "Available", value: available },
    { name: "Delegated", value: delegated },
    { name: "Unbonding", value: unbonding },
    { name: "Rewards", value: totalRewards },
  ].filter((d) => d.value > 0);

  const delChart = enrichedDels
    .slice()
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10)
    .map((d) => ({
      name: d.moniker || shorten(d.valoper, 6, 4),
      amount: d.amount / Math.pow(10, defaultNetwork.tokenDecimals),
    }));

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="h-14 w-14 rounded-2xl bg-primary/15 grid place-items-center text-primary ring-2 ring-primary/30">
            <Wallet className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              {isVal ? "Validator Operator" : "Account"}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <h1 className="text-base sm:text-lg font-mono break-all">{address}</h1>
              <CopyButton value={address} />
            </div>
            {isVal && (
              <Link
                to="/validators/$address"
                params={{ address }}
                className="text-xs text-primary hover:underline mt-2 inline-block"
              >
                View validator profile →
              </Link>
            )}
          </div>
          {isOwn && (
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setSendOpen(true)}
                className="bg-gradient-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium inline-flex items-center justify-center gap-2 shadow-glow hover:opacity-90"
              >
                <Send className="h-4 w-4" /> Send
              </button>
              <button
                onClick={() => setClaimOpen(true)}
                disabled={totalRewards === 0}
                className="border border-border rounded-lg px-4 py-2 text-sm inline-flex items-center justify-center gap-2 hover:bg-accent/40 disabled:opacity-50"
              >
                <Coins className="h-4 w-4" /> Claim All
              </button>
            </div>
          )}
          {!wallet && (
            <button
              onClick={connect}
              className="border border-border rounded-lg px-4 py-2 text-sm hover:bg-accent/40"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </Card>

      <TransactionModal open={sendOpen} onOpenChange={setSendOpen} mode="send" />
      <ClaimDialog
        open={claimOpen}
        onOpenChange={setClaimOpen}
        validatorAddrs={(rewards?.rewards ?? []).map((r: any) => r.validator_address)}
        totalRewardsUjay={totalRewards.toFixed(0)}
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Available" value={formatAmount(available)} />
        <Stat label="Delegated" value={formatAmount(delegated)} />
        <Stat label="Unbonding" value={formatAmount(unbonding)} />
        <Stat label="Rewards" value={formatAmount(totalRewards.toFixed(0))} />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Portfolio Breakdown</h2>
            <span className="text-xs font-mono text-muted-foreground">
              {formatAmount(totalPortfolio.toFixed(0))}
            </span>
          </div>
          <div className="h-64">
            {pieData.length === 0 ? (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">
                No assets yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: any) => formatAmount(Number(v).toFixed(0))}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Top Delegations</h2>
            <span className="text-xs text-muted-foreground">{enrichedDels.length} total</span>
          </div>
          <div className="h-64">
            {delChart.length === 0 ? (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">
                No delegations
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={delChart} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="name"
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={60}
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  />
                  <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: any) => `${Number(v).toLocaleString()} ${defaultNetwork.coinDenom}`}
                  />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                    {delChart.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Delegations list with avatar + moniker */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold inline-flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" /> Delegations
          </h2>
          <span className="text-xs text-muted-foreground">{enrichedDels.length}</span>
        </div>
        <div className="divide-y divide-border">
          {enrichedDels.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              No delegations
            </div>
          ) : (
            enrichedDels.map((d) => (
              <Link
                key={d.valoper}
                to="/validators/$address"
                params={{ address: d.valoper }}
                className="flex items-center justify-between px-5 py-3 hover:bg-accent/30 transition gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <ValidatorAvatar identity={d.identity} moniker={d.moniker} size={32} />
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {d.moniker || shorten(d.valoper, 10, 6)}
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono truncate">
                      {shorten(d.valoper, 14, 8)}
                    </div>
                  </div>
                  {d.jailed && <Badge variant="destructive">jailed</Badge>}
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-xs">{formatAmount(d.amount)}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {((delegated ? d.amount / delegated : 0) * 100).toFixed(2)}%
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </Card>

      {/* Recent transactions */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold">Recent Transactions</h2>
          <span className="text-xs text-muted-foreground">{recentTxs.length}</span>
        </div>
        <div className="divide-y divide-border">
          {recentTxs.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              No recent transactions
            </div>
          ) : (
            recentTxs.map((t) => {
              const decoded = (() => {
                try {
                  const tx_b64 =
                    typeof t.tx === "string"
                      ? t.tx
                      : btoa(String.fromCharCode(...(t.tx ?? [])));
                  return decodeTx(tx_b64);
                } catch {
                  return null;
                }
              })();
              const firstMsg = decoded?.messages?.[0];
              const msgType = firstMsg?.typeUrl?.split(".").pop() ?? "Tx";
              const success = t.tx_result?.code === 0 || t.tx_result?.code === undefined;
              const dir = t._dir;
              return (
                <Link
                  key={t.hash}
                  to="/transactions/$hash"
                  params={{ hash: t.hash }}
                  className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-accent/30 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`h-9 w-9 rounded-lg grid place-items-center shrink-0 ${
                        dir === "in"
                          ? "bg-success/15 text-success"
                          : "bg-primary/15 text-primary"
                      }`}
                    >
                      {dir === "in" ? (
                        <ArrowDownLeft className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium flex items-center gap-2">
                        <span>{msgType}</span>
                        {!success && <Badge variant="destructive">failed</Badge>}
                        {decoded && decoded.messages.length > 1 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{decoded.messages.length - 1}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono truncate">
                        {shorten(t.hash, 12, 8)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-mono">#{t.height}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {timeAgo(t.tx_result?.timestamp)}
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-lg font-bold mt-1 font-mono">{value}</div>
    </Card>
  );
}
