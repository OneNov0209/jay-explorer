import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { lcd, rpc, safe } from "@/lib/cosmos";
import { Card, Badge, Skeleton } from "@/components/shared/ui";
import { CopyButton } from "@/components/shared/CopyButton";
import { formatAmount, pct, shorten } from "@/lib/format";
import { ExternalLink, Coins, ArrowDownToLine, Send, Activity, Search, Repeat, Wallet } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useWallet } from "@/lib/wallet";
import { useMemo, useState } from "react";
import { TransactionModal, type TxMode } from "@/components/tx/TransactionModal";
import { ClaimDialog, WithdrawCommissionDialog } from "@/components/tx/VoteClaimDialogs";
import { defaultNetwork } from "@/data/networks";
import { ValidatorAvatar, consAddrFromPubkey } from "@/routes/validators";
import { normalizeHex } from "@/lib/bech32";
import { fromBech32, toBech32, toHex } from "@cosmjs/encoding";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/validators/$address")({
  head: ({ params }) => ({
    meta: [
      { title: `Validator ${params.address.slice(0, 16)}… · Jay Network Explorer` },
    ],
  }),
  component: ValidatorDetail,
});

function ValidatorDetail() {
  const { address } = Route.useParams();
  const { address: wallet, connect } = useWallet();
  const [txOpen, setTxOpen] = useState(false);
  const [txMode, setTxMode] = useState<TxMode>("delegate");
  const [claimOpen, setClaimOpen] = useState(false);
  const [commOpen, setCommOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["validator", address],
    queryFn: () => safe(lcd.validator(address)),
  });
  const { data: dels } = useQuery({
    queryKey: ["val-dels", address],
    queryFn: () => safe(lcd.validatorDelegations(address)),
  });
  const { data: rewards } = useQuery({
    queryKey: ["val-rewards-mine", address, wallet],
    queryFn: () => safe(lcd.rewards(wallet!)),
    enabled: !!wallet,
  });

  const v = data?.validator;

  const selfAcc = useMemo(() => {
    if (!v?.operator_address) return null;
    try {
      const { data: bytes } = fromBech32(v.operator_address);
      return toBech32(defaultNetwork.bech32Config.bech32PrefixAccAddr, bytes);
    } catch {
      return null;
    }
  }, [v?.operator_address]);

  const { data: selfDel } = useQuery({
    queryKey: ["val-self-del", v?.operator_address, selfAcc],
    queryFn: () => safe(lcd.validatorSelfDelegation(v.operator_address, selfAcc!)),
    enabled: !!v?.operator_address && !!selfAcc,
    refetchInterval: 30_000,
  });
  const selfBondedAmt = selfDel?.delegation_response?.balance?.amount ?? "0";

  const { data: commissionData } = useQuery({
    queryKey: ["val-commission", v?.operator_address],
    queryFn: () => safe(lcd.validatorCommission(v.operator_address)),
    enabled: !!v?.operator_address,
    refetchInterval: 20_000,
  });
  const { data: outstandingData } = useQuery({
    queryKey: ["val-outstanding", v?.operator_address],
    queryFn: () => safe(lcd.validatorOutstandingRewards(v.operator_address)),
    enabled: !!v?.operator_address,
    refetchInterval: 20_000,
  });
  const commissionAmt =
    (commissionData as any)?.commission?.commission?.find(
      (c: any) => c.denom === defaultNetwork.denom,
    )?.amount ?? "0";
  const outstandingAmt =
    (outstandingData as any)?.rewards?.rewards?.find(
      (c: any) => c.denom === defaultNetwork.denom,
    )?.amount ?? "0";

  const { data: myRewardData } = useQuery({
    queryKey: ["val-my-reward", v?.operator_address, wallet],
    queryFn: () => safe(lcd.delegationReward(wallet!, v.operator_address)),
    enabled: !!v?.operator_address && !!wallet,
    refetchInterval: 20_000,
  });
  const myRewardAmt =
    (myRewardData as any)?.rewards?.find((c: any) => c.denom === defaultNetwork.denom)
      ?.amount ?? "0";

  const { data: myDelData } = useQuery({
    queryKey: ["val-my-del", v?.operator_address, wallet],
    queryFn: () => safe(lcd.validatorSelfDelegation(v.operator_address, wallet!)),
    enabled: !!v?.operator_address && !!wallet,
    refetchInterval: 20_000,
  });
  const myStakeAmt =
    (myDelData as any)?.delegation_response?.balance?.amount ?? "0";

  const isOperator = !!wallet && !!selfAcc && wallet === selfAcc;

  const openTx = (mode: TxMode) => {
    if (!wallet) {
      connect();
      return;
    }
    setTxMode(mode);
    setTxOpen(true);
  };

  const openClaim = () => {
    if (!wallet) {
      connect();
      return;
    }
    setClaimOpen(true);
  };

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!v)
    return (
      <Card className="p-8 text-center text-muted-foreground">
        Validator not found or unavailable.
      </Card>
    );

  const status = v.jailed
    ? "jailed"
    : v.status === "BOND_STATUS_BONDED"
      ? "active"
      : "inactive";

  return (
    <div className="space-y-6">
      <ValidatorSwitcher current={v.operator_address} currentMoniker={v.description?.moniker} />

      {/* Hero card */}
      <Card className="card-3d p-6 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-[var(--chart-2)]/10 blur-3xl" />
        <div className="relative flex flex-col md:flex-row gap-5 items-start">
          <ValidatorAvatar identity={v.description?.identity} moniker={v.description?.moniker} size={64} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{v.description?.moniker}</h1>
              <Badge
                variant={
                  status === "active"
                    ? "success"
                    : status === "jailed"
                      ? "destructive"
                      : "muted"
                }
              >
                {status}
              </Badge>
            </div>
            {v.description?.identity && (
              <div className="text-xs text-muted-foreground mt-1">
                Identity: {v.description.identity}
              </div>
            )}
            {v.description?.website && (
              <a
                href={v.description.website}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
              >
                {v.description.website} <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {v.description?.details && (
              <p className="text-sm text-muted-foreground mt-3 max-w-2xl">
                {v.description.details}
              </p>
            )}
            <div className="mt-3 flex items-center gap-2 font-mono text-xs">
              <span className="text-muted-foreground">{shorten(v.operator_address, 16, 8)}</span>
              <CopyButton value={v.operator_address} />
            </div>
          </div>
          <div className="flex flex-col gap-2 w-full md:w-auto">
            <button
              onClick={() => openTx("delegate")}
              className="btn-3d bg-gradient-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium inline-flex items-center justify-center gap-2"
            >
              <Send className="h-4 w-4" /> Delegate
            </button>
            <button
              onClick={() => openTx("redelegate")}
              className="btn-3d border border-border rounded-lg px-4 py-2 text-sm inline-flex items-center justify-center gap-2 hover:bg-accent/40"
            >
              <Repeat className="h-4 w-4" /> Redelegate
            </button>
            <button
              onClick={() => openTx("undelegate")}
              className="btn-3d border border-border rounded-lg px-4 py-2 text-sm inline-flex items-center justify-center gap-2 hover:bg-accent/40"
            >
              <ArrowDownToLine className="h-4 w-4" /> Undelegate
            </button>
            <button
              onClick={openClaim}
              className="btn-3d border border-border rounded-lg px-4 py-2 text-sm inline-flex items-center justify-center gap-2 hover:bg-accent/40"
            >
              <Coins className="h-4 w-4" /> Claim Rewards
            </button>
            {isOperator && (
              <button
                onClick={() => {
                  if (!wallet) return connect();
                  setCommOpen(true);
                }}
                className="btn-3d border border-warning/40 text-warning rounded-lg px-4 py-2 text-sm inline-flex items-center justify-center gap-2 hover:bg-warning/10"
              >
                <Wallet className="h-4 w-4" /> Withdraw Commission
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* CHARTS DI ATAS METRIC CARDS */}
      <DelegationsChart dels={dels} selfAcc={selfAcc} validatorTokens={v.tokens} />

      {/* Rewards / commission / outstanding metrics */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Outstanding Rewards"
          value={formatAmount(outstandingAmt, { precision: 4 })}
          hint="Pool-wide pending"
        />
        <MetricCard
          label="Commission Pool"
          value={formatAmount(commissionAmt, { precision: 4 })}
          hint="Withdrawable by operator"
        />
        <MetricCard
          label="My Pending Reward"
          value={wallet ? formatAmount(myRewardAmt, { precision: 6 }) : "—"}
          hint={wallet ? "From this validator" : "Connect wallet"}
        />
        <MetricCard
          label="My Stake"
          value={wallet ? formatAmount(myStakeAmt, { precision: 4 }) : "—"}
          hint={wallet ? "Your delegation" : "Connect wallet"}
        />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Voting Power" value={formatAmount(v.tokens, { precision: 0 })} />
        <MetricCard
          label="Self Delegation"
          value={formatAmount(selfBondedAmt, { precision: 0 })}
          hint={`Min ${formatAmount(v.min_self_delegation, { precision: 0 })}`}
        />
        <MetricCard
          label="Commission"
          value={pct(Number(v.commission?.commission_rates?.rate ?? 0))}
          hint={`Max ${pct(Number(v.commission?.commission_rates?.max_rate ?? 0))}`}
        />
        <MetricCard
          label="Max Change"
          value={pct(Number(v.commission?.commission_rates?.max_change_rate ?? 0))}
          hint="Daily"
        />
      </div>

      <ExtendedDetails validator={v} />

      <ValidatorTransactions validator={v} />

      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold">Top Delegators</h2>
          <div className="text-xs text-muted-foreground">
            {dels?.delegation_responses?.length ?? 0} shown
          </div>
        </div>
        <div className="divide-y divide-border">
          {(dels?.delegation_responses ?? [])
            .sort((a: any, b: any) => Number(b.balance.amount) - Number(a.balance.amount))
            .slice(0, 25)
            .map((d: any) => (
              <Link
                key={d.delegation.delegator_address}
                to="/accounts/$address"
                params={{ address: d.delegation.delegator_address }}
                className="flex items-center justify-between px-5 py-3 hover:bg-accent/30"
              >
                <span className="font-mono text-xs">
                  {shorten(d.delegation.delegator_address, 12, 8)}
                </span>
                <span className="font-mono text-xs">{formatAmount(d.balance.amount)}</span>
              </Link>
            ))}
          {(!dels || dels.delegation_responses?.length === 0) && (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              No delegators data
            </div>
          )}
        </div>
      </Card>

      <TransactionModal
        open={txOpen}
        onOpenChange={setTxOpen}
        mode={txMode}
        validatorAddress={v.operator_address}
        validatorMoniker={v.description?.moniker}
      />
      <ClaimDialog
        open={claimOpen}
        onOpenChange={setClaimOpen}
        validatorAddrs={
          rewards?.rewards
            ?.filter((r: any) => r.validator_address === v.operator_address)
            ?.map((r: any) => r.validator_address) ?? [v.operator_address]
        }
        totalRewardsUjay={
          rewards?.rewards
            ?.find((r: any) => r.validator_address === v.operator_address)
            ?.reward?.find((c: any) => c.denom === defaultNetwork.denom)?.amount ?? "0"
        }
      />
      <WithdrawCommissionDialog
        open={commOpen}
        onOpenChange={setCommOpen}
        validatorOperator={v.operator_address}
        commissionUjay={commissionAmt}
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <Card className="card-3d p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-lg font-bold mt-1 bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
    </Card>
  );
}

function UptimeCard({ validator }: { validator: any }) {
  const valcons = useMemo(() => consAddrFromPubkey(validator.consensus_pubkey), [validator]);
  const hexCons = useMemo(() => {
    try {
      if (!valcons) return null;
      return toHex(fromBech32(valcons).data).toUpperCase();
    } catch {
      return null;
    }
  }, [valcons]);

  const { data: signing } = useQuery({
    queryKey: ["signing-info-one", valcons ?? ""],
    queryFn: () => safe(lcd.signingInfo(valcons!)),
    enabled: !!valcons,
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
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
    return Array.from({ length: 100 }, (_, i) => tip - i).filter((h) => h > 0);
  }, [tip]);

  const { data: blocks } = useQuery({
    queryKey: ["uptime-commits-100", heights[0] ?? 0],
    queryFn: async () => {
      const res = await Promise.all(heights.map((h) => rpc.block(h).catch(() => null)));
      return res;
    },
    enabled: heights.length > 0 && !!hexCons,
    refetchInterval: defaultNetwork.blockTime * 2000,
    placeholderData: keepPreviousData,
  });

  const recent = useMemo(() => {
    if (!blocks || !hexCons)
      return [] as Array<{ h: number; sig: "yes" | "no" | "absent"; time?: string }>;
    return blocks
      .filter(Boolean)
      .map((b: any) => {
        const h = Number(b?.result?.block?.header?.height ?? 0);
        const time = b?.result?.block?.header?.time;
        const sigs: any[] = b?.result?.block?.last_commit?.signatures ?? [];
        const found = sigs.find(
          (s) => s.validator_address && normalizeHex(s.validator_address) === hexCons,
        );
        const st: "yes" | "no" | "absent" = found
          ? found.block_id_flag === 2 ||
            found.block_id_flag === 3 ||
            found.block_id_flag === "BLOCK_ID_FLAG_COMMIT"
            ? "yes"
            : "no"
          : "absent";
        return { h, sig: st, time };
      })
      .sort((a, b) => b.h - a.h);
  }, [blocks, hexCons]);

  const window = Number(slashingParams?.params?.signed_blocks_window ?? 10000);
  const missed = Number(signing?.val_signing_info?.missed_blocks_counter ?? 0);
  const uptime = window ? Math.max(0, 1 - missed / window) : 1;
  const tombstoned = signing?.val_signing_info?.tombstoned;

  const localSigned = recent.filter((r) => r.sig === "yes").length;
  const localMissed = recent.filter((r) => r.sig === "no").length;
  const localAbsent = recent.filter((r) => r.sig === "absent").length;

  const [filter, setFilter] = useState<"all" | "yes" | "no" | "absent">("all");
  const [selected, setSelected] = useState<{
    h: number;
    sig: "yes" | "no" | "absent";
    time?: string;
  } | null>(null);

  const filtered = useMemo(
    () => (filter === "all" ? recent : recent.filter((r) => r.sig === filter)),
    [recent, filter],
  );

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <ValidatorAvatar
            identity={validator.description?.identity}
            moniker={validator.description?.moniker}
            size={40}
          />
          <div>
            <div className="font-semibold leading-tight flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              {validator.description?.moniker}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Uptime — Last {recent.length || 100} blocks (PingPub style)
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div>
            <span className="text-muted-foreground">Window: </span>
            <span className="font-mono">{window.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Missed: </span>
            <span className="font-mono text-destructive">{missed.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Uptime: </span>
            <span
              className={`font-mono font-bold ${
                uptime >= 0.99
                  ? "text-success"
                  : uptime >= 0.95
                    ? "text-warning"
                    : "text-destructive"
              }`}
            >
              {(uptime * 100).toFixed(2)}%
            </span>
          </div>
          {tombstoned && <Badge variant="destructive">Tombstoned</Badge>}
        </div>
      </div>

      <div className="flex flex-wrap gap-1 p-1 bg-muted/30 border border-border rounded-lg w-fit mb-3 text-xs">
        {(
          [
            { k: "all", label: `All (${recent.length})` },
            { k: "yes", label: `🟩 Signed (${localSigned})` },
            { k: "no", label: `🟨 Missed (${localMissed})` },
            { k: "absent", label: `🟥 Absent (${localAbsent})` },
          ] as const
        ).map((t) => (
          <button
            key={t.k}
            onClick={() => setFilter(t.k as any)}
            className={`px-2.5 py-1 rounded-md transition ${
              filter === t.k
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(22px, 1fr))" }}
      >
        {recent.length === 0 &&
          Array.from({ length: 100 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full rounded" />
          ))}
        {filtered.map(({ h, sig, time }) => (
          <button
            key={h}
            type="button"
            onClick={() => setSelected({ h, sig, time })}
            title={`Block #${h.toLocaleString()} — ${
              sig === "yes" ? "Signed" : sig === "no" ? "Missed" : "Absent"
            }`}
            className={`h-6 rounded-sm transition cursor-pointer hover:ring-2 hover:ring-primary/50 ${
              sig === "yes"
                ? "bg-success/80 hover:bg-success"
                : sig === "no"
                  ? "bg-warning/80 hover:bg-warning"
                  : "bg-destructive/80 hover:bg-destructive"
            }`}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-4 mt-4 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-success/80" /> 🟩 Signed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-warning/80" /> 🟨 Missed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-destructive/80" /> 🟥 Absent
        </span>
        <span className="ml-auto">Click any cell for block details</span>
      </div>

      <BlockSignatureDialog
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        info={selected}
        moniker={validator.description?.moniker}
      />
    </Card>
  );
}

function BlockSignatureDialog({
  open,
  onOpenChange,
  info,
  moniker,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  info: { h: number; sig: "yes" | "no" | "absent"; time?: string } | null;
  moniker?: string;
}) {
  if (!info) return null;
  const label = info.sig === "yes" ? "Signed" : info.sig === "no" ? "Missed" : "Absent";
  const variant: "success" | "warning" | "destructive" =
    info.sig === "yes" ? "success" : info.sig === "no" ? "warning" : "destructive";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Block #{info.h.toLocaleString()}
            <Badge variant={variant}>{label}</Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <div className="text-xs uppercase text-muted-foreground">Validator</div>
            <div className="font-medium">{moniker}</div>
          </div>
          {info.time && (
            <div>
              <div className="text-xs uppercase text-muted-foreground">Time</div>
              <div className="font-mono text-xs">
                {new Date(info.time).toLocaleString()}
              </div>
            </div>
          )}
          <div>
            <div className="text-xs uppercase text-muted-foreground">Signature status</div>
            <div className="text-sm">
              {info.sig === "yes" && "Validator signed this block (counted toward uptime)."}
              {info.sig === "no" &&
                "Validator was in the active set but did NOT sign this block."}
              {info.sig === "absent" &&
                "Validator was not present in the commit signatures list (likely outside the active set)."}
            </div>
          </div>
          <div className="pt-2 border-t border-border flex justify-end">
            <Link
              to="/blocks/$height"
              params={{ height: String(info.h) }}
              className="text-primary text-sm hover:underline inline-flex items-center gap-1"
              onClick={() => onOpenChange(false)}
            >
              Open block <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type Status = "all" | "active" | "inactive" | "jailed";

function ValidatorSwitcher({
  current,
  currentMoniker,
}: {
  current: string;
  currentMoniker?: string;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status>("all");

  const { data: bonded } = useQuery({
    queryKey: ["vals-bonded"],
    queryFn: () => safe(lcd.validatorsAll("BOND_STATUS_BONDED")),
  });
  const { data: unbonded } = useQuery({
    queryKey: ["vals-unbonded"],
    queryFn: () => safe(lcd.validatorsAll("BOND_STATUS_UNBONDED")),
  });
  const { data: unbonding } = useQuery({
    queryKey: ["vals-unbonding"],
    queryFn: () => safe(lcd.validatorsAll("BOND_STATUS_UNBONDING")),
  });

  const list = useMemo(() => {
    const all = [
      ...(bonded?.validators ?? []),
      ...(unbonded?.validators ?? []),
      ...(unbonding?.validators ?? []),
    ];
    let filtered = all;
    if (status === "active")
      filtered = all.filter((v: any) => v.status === "BOND_STATUS_BONDED" && !v.jailed);
    else if (status === "inactive")
      filtered = all.filter((v: any) => v.status !== "BOND_STATUS_BONDED" && !v.jailed);
    else if (status === "jailed") filtered = all.filter((v: any) => v.jailed);

    const ql = q.trim().toLowerCase();
    if (ql)
      filtered = filtered.filter(
        (v: any) =>
          v.description?.moniker?.toLowerCase().includes(ql) ||
          v.operator_address?.toLowerCase().includes(ql),
      );

    return [...filtered]
      .sort((a: any, b: any) => Number(b.tokens) - Number(a.tokens))
      .slice(0, 50);
  }, [bonded, unbonded, unbonding, q, status]);

  return (
    <Card className="p-3 flex flex-col sm:flex-row gap-2 sm:items-center">
      <div className="text-xs text-muted-foreground px-1 shrink-0">
        Switch validator:
      </div>
      <div className="relative flex-1">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          value={q}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          placeholder={`Search by moniker or address (current: ${currentMoniker ?? shorten(current, 10, 6)})`}
          className="w-full pl-10 pr-3 h-9 text-sm rounded-lg bg-card border border-border focus:border-primary focus:outline-none"
        />
        {open && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setOpen(false)}
            />
            <div className="absolute z-20 left-0 right-0 top-full mt-1 max-h-80 overflow-y-auto rounded-lg border border-border bg-card shadow-xl">
              {list.length === 0 ? (
                <div className="p-4 text-xs text-muted-foreground text-center">
                  No validators found
                </div>
              ) : (
                list.map((v: any) => {
                  const st = v.jailed
                    ? "jailed"
                    : v.status === "BOND_STATUS_BONDED"
                      ? "active"
                      : "inactive";
                  return (
                    <button
                      key={v.operator_address}
                      onClick={() => {
                        setOpen(false);
                        setQ("");
                        navigate({
                          to: "/validators/$address",
                          params: { address: v.operator_address },
                        });
                      }}
                      className={`w-full text-left px-3 py-2 hover:bg-accent/40 flex items-center gap-3 ${
                        v.operator_address === current ? "bg-primary/10" : ""
                      }`}
                    >
                      <ValidatorAvatar
                        identity={v.description?.identity}
                        moniker={v.description?.moniker}
                        size={24}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">
                          {v.description?.moniker || shorten(v.operator_address)}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono truncate">
                          {shorten(v.operator_address, 12, 6)}
                        </div>
                      </div>
                      <Badge
                        variant={
                          st === "active"
                            ? "success"
                            : st === "jailed"
                              ? "destructive"
                              : "muted"
                        }
                        className="ml-auto"
                      >
                        {st}
                      </Badge>
                    </button>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-1 p-1 bg-muted/30 border border-border rounded-lg text-xs">
        {(["all", "active", "inactive", "jailed"] as Status[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-2.5 py-1 rounded-md capitalize transition ${
              status === s
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </Card>
  );
}

function selfAccountFromValoper(valoper: string): string | null {
  try {
    const { data } = fromBech32(valoper);
    return toBech32(defaultNetwork.bech32Config.bech32PrefixAccAddr, data);
  } catch {
    return null;
  }
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-2 border-b border-border/60 last:border-b-0">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-mono break-all sm:text-right max-w-full">{value}</div>
    </div>
  );
}

function ExtendedDetails({ validator: v }: { validator: any }) {
  const { selfAccount, hexAddr, valcons } = useMemo(() => {
    const acc = selfAccountFromValoper(v.operator_address);
    const cons = consAddrFromPubkey(v.consensus_pubkey);
    let hex: string | null = null;
    try {
      hex = cons ? toHex(fromBech32(cons).data).toUpperCase() : null;
    } catch {
      hex = null;
    }
    return { selfAccount: acc, hexAddr: hex, valcons: cons };
  }, [v]);

  const { data: pool } = useQuery({
    queryKey: ["pool"],
    queryFn: () => safe(lcd.pool()),
  });
  const { data: ap } = useQuery({
    queryKey: ["annual-provisions"],
    queryFn: () => safe(lcd.annualProvisions()),
  });
  const { data: distParams } = useQuery({
    queryKey: ["dist-params"],
    queryFn: () => safe(lcd.distributionParams()),
  });
  const { data: dels } = useQuery({
    queryKey: ["val-dels", v.operator_address],
    queryFn: () => safe(lcd.validatorDelegations(v.operator_address)),
  });
  const { data: signing } = useQuery({
    queryKey: ["signing-info-one", valcons ?? ""],
    queryFn: () => safe(lcd.signingInfo(valcons!)),
    enabled: !!valcons,
  });

  const tokens = Number(v.tokens ?? 0);
  const totalBonded = Number(pool?.pool?.bonded_tokens ?? 0);
  const annualProv = Number(ap?.annual_provisions ?? 0);
  const commRate = Number(v.commission?.commission_rates?.rate ?? 0);
  const commMax = Number(v.commission?.commission_rates?.max_rate ?? 0);
  const commMaxChg = Number(v.commission?.commission_rates?.max_change_rate ?? 0);
  const commTax = Number(distParams?.params?.community_tax ?? 0);

  const annualProfitU =
    totalBonded > 0
      ? (annualProv * (1 - commTax) * tokens * (1 - commRate)) / totalBonded
      : 0;
  const apr =
    totalBonded > 0 && tokens > 0
      ? (annualProv * (1 - commTax) * (1 - commRate)) / totalBonded
      : 0;

  const selfDel = useMemo(() => {
    if (!selfAccount) return null;
    const found = (dels?.delegation_responses ?? []).find(
      (d: any) => d.delegation.delegator_address === selfAccount,
    );
    return found?.balance?.amount ?? null;
  }, [dels, selfAccount]);

  const consPubkey = v.consensus_pubkey?.key ?? "";
  const consPubkeyType = v.consensus_pubkey?.["@type"] ?? "";

  const status = v.jailed
    ? "JAILED"
    : v.status === "BOND_STATUS_BONDED"
      ? "BONDED"
      : v.status?.replace("BOND_STATUS_", "") ?? "UNKNOWN";

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card className="p-5">
        <h3 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">
          About Us
        </h3>
        <div className="space-y-1">
          <Row
            label="Website"
            value={
              v.description?.website ? (
                <a
                  href={v.description.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  {v.description.website} <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span className="text-muted-foreground">—</span>
              )
            }
          />
          <Row
            label="Contact"
            value={
              v.description?.security_contact || (
                <span className="text-muted-foreground">—</span>
              )
            }
          />
          <Row
            label="Identity"
            value={v.description?.identity || <span className="text-muted-foreground">—</span>}
          />
          <Row
            label="Details"
            value={v.description?.details || <span className="text-muted-foreground">—</span>}
          />
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">
          Validator Status
        </h3>
        <div className="space-y-1">
          <Row
            label="Status"
            value={
              <Badge
                variant={
                  status === "BONDED"
                    ? "success"
                    : status === "JAILED"
                      ? "destructive"
                      : "muted"
                }
              >
                {status}
              </Badge>
            }
          />
          <Row label="Jailed" value={v.jailed ? "Yes" : "No"} />
          <Row
            label="Tombstoned"
            value={signing?.val_signing_info?.tombstoned ? "Yes" : "No"}
          />
          <Row
            label="Missed Blocks"
            value={Number(
              signing?.val_signing_info?.missed_blocks_counter ?? 0,
            ).toLocaleString()}
          />
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">
          Liquid Staking
        </h3>
        <div className="space-y-1">
          <Row
            label="Validator Bonded"
            value={
              v.validator_bond_shares
                ? formatAmount(v.validator_bond_shares, { precision: 0 })
                : "—"
            }
          />
          <Row
            label="Liquid Shares"
            value={
              v.liquid_shares ? formatAmount(v.liquid_shares, { precision: 0 }) : "—"
            }
          />
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">
          Stake
        </h3>
        <div className="space-y-1">
          <Row label="Total Bonded Tokens" value={formatAmount(tokens, { precision: 0 })} />
          <Row
            label="Self Bonded"
            value={
              selfDel ? formatAmount(selfDel, { precision: 0 }) : (
                <span className="text-muted-foreground">—</span>
              )
            }
          />
          <Row
            label="Min Self Delegation"
            value={formatAmount(v.min_self_delegation, { precision: 0 })}
          />
          <Row
            label="Annual Profit (est.)"
            value={
              <span>
                {formatAmount(annualProfitU, { precision: 2 })}{" "}
                <span className="text-muted-foreground text-[11px]">
                  ≈ {(apr * 100).toFixed(2)}% APR
                </span>
              </span>
            }
          />
          <Row label="Unbonding Height" value={v.unbonding_height ?? "—"} />
          <Row
            label="Unbonding Time"
            value={
              v.unbonding_time && !v.unbonding_time.startsWith("1970")
                ? new Date(v.unbonding_time).toLocaleString()
                : "—"
            }
          />
        </div>
      </Card>

      <Card className="p-5 lg:col-span-2">
        <h3 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">
          Commission &amp; Rewards
        </h3>
        <div className="grid sm:grid-cols-3 gap-4">
          <CommissionDial label="Current Rate" value={commRate} />
          <CommissionDial label="Max Rate" value={commMax} />
          <CommissionDial label="Max Change / Day" value={commMaxChg} />
        </div>
        <div className="mt-3 text-[11px] text-muted-foreground">
          Last updated:{" "}
          {v.commission?.update_time
            ? new Date(v.commission.update_time).toLocaleString()
            : "—"}
        </div>
      </Card>

      <Card className="p-5 lg:col-span-2">
        <h3 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">
          Addresses
        </h3>
        <div className="space-y-1">
          <AddrRow label="Account Address" value={selfAccount ?? "—"} />
          <AddrRow label="Operator Address" value={v.operator_address} />
          <AddrRow label="Hex Address" value={hexAddr ?? "—"} />
          <AddrRow label="Signer Address" value={selfAccount ?? "—"} />
          <AddrRow label="Consensus Address" value={valcons ?? "—"} />
          <AddrRow label="Consensus Public Key" value={consPubkey} hint={consPubkeyType} />
        </div>
      </Card>
    </div>
  );
}

function AddrRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-2 border-b border-border/60 last:border-b-0">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
        {hint && <div className="text-[10px] normal-case text-muted-foreground/70 mt-0.5">{hint}</div>}
      </div>
      <div className="flex items-center gap-2 font-mono text-xs break-all">
        <span>{value}</span>
        {value && value !== "—" && <CopyButton value={value} />}
      </div>
    </div>
  );
}

function CommissionDial({ label, value }: { label: string; value: number }) {
  const v = Math.min(1, Math.max(0, value));
  const C = 2 * Math.PI * 36;
  const dash = C * v;
  return (
    <div className="flex items-center gap-3">
      <svg width="84" height="84" viewBox="0 0 84 84" className="shrink-0">
        <circle
          cx="42"
          cy="42"
          r="36"
          stroke="hsl(var(--border))"
          strokeWidth="8"
          fill="none"
        />
        <circle
          cx="42"
          cy="42"
          r="36"
          stroke="hsl(var(--primary))"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${C}`}
          transform="rotate(-90 42 42)"
          style={{ transition: "stroke-dasharray 0.5s ease" }}
        />
        <text
          x="42"
          y="46"
          textAnchor="middle"
          className="fill-foreground font-bold"
          style={{ fontSize: 14 }}
        >
          {(v * 100).toFixed(1)}%
        </text>
      </svg>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function ValidatorTransactions({ validator: v }: { validator: any }) {
  const [tab, setTab] = useState<"all" | "delegate" | "unbond">("all");
  const operator = v.operator_address;

  const query = useMemo(() => {
    if (tab === "delegate") return `delegate.validator='${operator}'`;
    if (tab === "unbond") return `unbond.validator='${operator}'`;
    return `message.sender='${selfAccountFromValoper(operator) ?? operator}'`;
  }, [tab, operator]);

  const { data, isLoading } = useQuery({
    queryKey: ["val-tx-search", query],
    queryFn: () => safe(rpc.txSearch(query, 1, 25, "desc")),
    refetchInterval: 30_000,
  });

  const txs: any[] = data?.result?.txs ?? [];

  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="font-semibold">Transactions &amp; Voting Power Events</h2>
        <div className="flex gap-1 p-1 bg-muted/30 rounded-lg text-xs">
          {(["all", "delegate", "unbond"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1 rounded-md capitalize transition ${
                tab === t
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="divide-y divide-border">
        {isLoading && (
          <div className="p-6">
            <Skeleton className="h-12 w-full" />
          </div>
        )}
        {!isLoading && txs.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            No transactions found
          </div>
        )}
        {txs.map((t: any) => (
          <Link
            key={t.hash}
            to="/transactions/$hash"
            params={{ hash: String(t.hash).toUpperCase() }}
            className="flex items-center justify-between px-5 py-3 hover:bg-accent/30"
          >
            <div className="min-w-0">
              <div className="font-mono text-xs truncate">
                {shorten(String(t.hash).toUpperCase(), 14, 10)}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Block #{Number(t.height).toLocaleString()} ·{" "}
                {t.tx_result?.code === 0 ? (
                  <span className="text-success">Success</span>
                ) : (
                  <span className="text-destructive">Failed</span>
                )}
              </div>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </Card>
  );
}

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

function DelegationsChart({
  dels,
  selfAcc,
  validatorTokens,
}: {
  dels: any;
  selfAcc: string | null;
  validatorTokens: string;
}) {
  const decimals = defaultNetwork.tokenDecimals;
  const denom = defaultNetwork.coinDenom;

  const sorted = useMemo(() => {
    const list: any[] = dels?.delegation_responses ?? [];
    return [...list].sort(
      (a, b) => Number(b.balance.amount) - Number(a.balance.amount),
    );
  }, [dels]);

  const top = useMemo(() => {
    return sorted.slice(0, 10).map((d, i) => {
      const addr = d.delegation.delegator_address;
      const amount = Number(d.balance.amount) / Math.pow(10, decimals);
      return {
        name: shorten(addr, 6, 4),
        full: addr,
        amount,
        isSelf: !!selfAcc && addr === selfAcc,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      };
    });
  }, [sorted, selfAcc, decimals]);

  const composition = useMemo(() => {
    const total = Number(validatorTokens) || 0;
    const visible = sorted.reduce((s, d) => s + Number(d.balance.amount), 0);
    const top5 = sorted.slice(0, 5);
    const others = visible - top5.reduce((s, d) => s + Number(d.balance.amount), 0);
    const hidden = Math.max(0, total - visible);
    const arr = top5.map((d) => ({
      name: shorten(d.delegation.delegator_address, 6, 4),
      value: Number(d.balance.amount) / Math.pow(10, decimals),
    }));
    if (others > 0)
      arr.push({ name: "Others (loaded)", value: others / Math.pow(10, decimals) });
    if (hidden > 0)
      arr.push({ name: "Other delegators", value: hidden / Math.pow(10, decimals) });
    return arr;
  }, [sorted, validatorTokens, decimals]);

  if (top.length === 0) return null;

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card className="card-3d chart-3d p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--chart-1)] shadow-[0_0_14px_var(--chart-1)]" />
          <div>
            <h2 className="font-semibold">Top 10 Delegators</h2>
            <div className="text-xs text-muted-foreground">
              Distribution by delegated {denom}
            </div>
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={top} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="name"
                stroke="var(--muted-foreground)"
                tick={{ fontSize: 11 }}
              />
              <YAxis stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: any) => [`${Number(v).toLocaleString()} ${denom}`, "Amount"]}
                labelFormatter={(_l, p: any) => p?.[0]?.payload?.full ?? ""}
              />
              <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                {top.map((d, i) => (
                  <Cell key={i} fill={d.isSelf ? "var(--chart-4)" : d.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="card-3d chart-3d p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--chart-2)] shadow-[0_0_14px_var(--chart-2)]" />
          <div>
            <h2 className="font-semibold">Voting Power Composition</h2>
            <div className="text-xs text-muted-foreground">
              Share of total voting power
            </div>
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={composition}
                dataKey="value"
                nameKey="name"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={2}
              >
                {composition.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: any) => `${Number(v).toLocaleString()} ${denom}`}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
