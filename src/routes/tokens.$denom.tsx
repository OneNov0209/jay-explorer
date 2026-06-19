// src/routes/tokens.$denom.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Card, Badge, Skeleton } from "@/components/shared/ui";
import { defaultNetwork } from "@/data/networks";
import { formatAmount, shorten } from "@/lib/format";
import { useWallet } from "@/lib/wallet";
import { sendTokens, estimateFee, type FeeTier } from "@/lib/tx";
import {
  Coins,
  Star,
  Send,
  Check,
  Loader2,
  Users,
  Activity,
  Info,
  Copy,
  ArrowLeft,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tokens/$denom")({
  head: ({ params }) => ({
    meta: [{ title: `${params.denom.slice(0, 16)}… · Tokens · Jay Network Explorer` }],
  }),
  component: TokenDetailPage,
});

function TokenDetailPage() {
  const { denom } = Route.useParams();
  const { address, connect } = useWallet();
  const [sendOpen, setSendOpen] = useState(false);
  const [receiver, setReceiver] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [tier, setTier] = useState<FeeTier>("average");
  const [step, setStep] = useState<"form" | "submitting" | "done">("form");
  const [hash, setHash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Fetch ALL supply (for this denom)
  const { data: supply, isLoading: supplyLoading } = useQuery({
    queryKey: ["token-supply", denom],
    queryFn: async () => {
      const api = defaultNetwork.apis[0];
      // Coba by_denom dulu
      let res = await fetch(`${api}/cosmos/bank/v1beta1/supply/by_denom?denom=${denom}`);
      if (!res.ok) {
        // Fallback ke supply list
        res = await fetch(`${api}/cosmos/bank/v1beta1/supply?pagination.limit=1000`);
        if (!res.ok) return { amount: { amount: "0" } };
        const data = await res.json();
        const found = (data.supply ?? []).find((s: any) => s.denom === denom);
        return { amount: { amount: found?.amount ?? "0" } };
      }
      const data = await res.json();
      return { amount: { amount: data.amount?.amount ?? "0" } };
    },
    refetchInterval: 30_000,
  });

  // Fetch metadata
  const { data: metadataList, isLoading: metadataLoading } = useQuery({
    queryKey: ["token-metadata"],
    queryFn: async () => {
      const api = defaultNetwork.apis[0];
      const res = await fetch(`${api}/cosmos/bank/v1beta1/denoms_metadata?pagination.limit=500`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.metadatas ?? []) as any[];
    },
  });

  // Fetch Chain Registry IBC asset map
  const { data: ibcAssetMap } = useQuery({
    queryKey: ["ibc-asset-single", denom],
    queryFn: async () => {
      const map = new Map<string, { name: string; symbol: string; logo: string; chain: string }>();
      try {
        const res = await fetch(
          `https://raw.githubusercontent.com/cosmos/chain-registry/master/thejaynetwork/assetlist.json`,
        );
        if (!res.ok) return map;
        const data = await res.json();
        for (const asset of data.assets ?? []) {
          if (!asset.denom_units || asset.denom === "ujay") continue;
          const ibcDenom = asset.denom_units.find((u: any) =>
            u.denom.startsWith("ibc/"),
          )?.denom || asset.denom;
          const trace = asset.traces?.[0] || {};
          map.set(ibcDenom, {
            name: asset.name || ibcDenom,
            symbol: asset.symbol || "",
            logo: asset.logo_URIs?.png || asset.image_sync?.png || "",
            chain: trace.counterparty_chain_name || "",
          });
        }
      } catch {}
      return map;
    },
    staleTime: 30 * 60_000,
  });

  // Fetch holders (top 50)
  const { data: holders, isLoading: holdersLoading } = useQuery({
    queryKey: ["token-holders", denom],
    queryFn: async () => {
      const api = defaultNetwork.apis[0];
      const res = await fetch(
        `${api}/cosmos/bank/v1beta1/denom_owners/${denom}?pagination.limit=50`,
      );
      if (!res.ok) return [];
      const data = await res.json();
      return (data.denom_owners ?? []) as any[];
    },
    refetchInterval: 30_000,
  });

  // Fetch user balance
  const { data: balance } = useQuery({
    queryKey: ["token-balance", denom, address],
    queryFn: async () => {
      if (!address) return "0";
      const api = defaultNetwork.apis[0];
      const res = await fetch(
        `${api}/cosmos/bank/v1beta1/balances/${address}/by_denom?denom=${denom}`,
      );
      if (!res.ok) return "0";
      const data = await res.json();
      return data.balance?.amount ?? "0";
    },
    enabled: !!address,
    refetchInterval: 15_000,
  });

  const token = useMemo(() => {
    const meta = metadataList?.find((m: any) => m.denom === denom || m.base === denom);
    const isNative = denom === defaultNetwork.denom;
    const isIBC = denom.startsWith("ibc/");
    const isFactory = !isNative && !isIBC;

    let displayName = "";
    let symbol = "";
    let logo = "";
    let description = "";
    let decimals = 6;

    if (meta) {
      displayName = meta.display || meta.name || "";
      symbol = meta.symbol || "";
      description = meta.description || "";
      decimals = meta.denom_units?.find((u: any) => u.denom === meta.display)?.exponent ?? 6;
      logo = meta.uri?.includes("http") ? meta.uri : null;
    }

    // IBC token: ambil dari Chain Registry
    if (isIBC && ibcAssetMap?.has(denom)) {
      const ibc = ibcAssetMap.get(denom)!;
      displayName = displayName || ibc.name;
      symbol = symbol || ibc.symbol;
      logo = logo || ibc.logo;
      if (ibc.chain && !description) description = `IBC token from ${ibc.chain}`;
    }

    // Native
    if (isNative) {
      displayName = displayName || defaultNetwork.coinDenom;
      symbol = symbol || defaultNetwork.coinDenom;
      decimals = defaultNetwork.tokenDecimals;
      logo = logo || defaultNetwork.logo;
    }

    // Token Factory: ambil subdenom
    if (isFactory && !displayName) {
      const parts = denom.replace("factory/", "").split("/");
      displayName = parts[parts.length - 1]?.toUpperCase() || denom.slice(0, 12) + "...";
      symbol = symbol || displayName.slice(0, 6);
    }

    if (!displayName) {
      displayName = denom.slice(0, 12) + "...";
    }

    return {
      denom,
      base: meta?.base || denom,
      displayName,
      symbol,
      description,
      decimals,
      logo,
      isNative,
      isIBC,
      isFactory,
      totalSupply: supply?.amount?.amount ?? "0",
    };
  }, [metadataList, denom, supply, ibcAssetMap]);

  const totalHolders = holders?.length ?? 0;
  const userBalance = balance ?? "0";

  const fee = estimateFee(tier, 100_000);

  const handleSend = async () => {
    if (!address) return connect();
    if (localStorage.getItem("jay-wallet-type") === "jay") {
      toast.warning("Please switch to Keplr for transactions");
      return;
    }
    if (!receiver || receiver.length < 10) return toast.error("Invalid receiver address");
    if (!sendAmount || Number(sendAmount) <= 0) return toast.error("Enter amount");

    const decimals = token?.decimals ?? 6;
    const [whole = "0", frac = ""] = sendAmount.split(".");
    const paddedFrac = (frac + "0".repeat(decimals)).slice(0, decimals);
    const amountInBase = BigInt(whole) * BigInt(10 ** decimals) + BigInt(paddedFrac || "0");

    setStep("submitting");
    setErr(null);
    try {
      const res = await sendTokens(address, receiver, amountInBase.toString(), tier);
      if (res.code && res.code !== 0) throw new Error(res.rawLog || `Code ${res.code}`);
      setHash(res.transactionHash);
      setStep("done");
      toast.success("Transfer sent!");
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      setStep("done");
      toast.error("Transfer failed", { description: e?.message });
    }
  };

  const isLoading = supplyLoading || metadataLoading;

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!token)
    return (
      <Card className="p-10 text-center text-muted-foreground">
        Token not found.
      </Card>
    );

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        to="/tokens"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Tokens
      </Link>

      {/* Hero Card */}
      <Card className="card-3d p-6 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row gap-5 items-start">
          {token.logo ? (
            <img
              src={token.logo}
              alt={token.displayName}
              className="h-16 w-16 rounded-full ring-2 ring-primary/30 shrink-0"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div
              className={`h-16 w-16 rounded-full grid place-items-center shrink-0 ring-2 ring-primary/30 ${
                token.isNative
                  ? "bg-primary/15 text-primary"
                  : token.isIBC
                    ? "bg-success/15 text-success"
                    : "bg-violet-500/15 text-violet-500"
              }`}
            >
              {token.isIBC ? <Globe className="h-8 w-8" /> : <Coins className="h-8 w-8" />}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{token.displayName}</h1>
              {token.symbol && (
                <Badge variant="default" className="text-sm">
                  {token.symbol}
                </Badge>
              )}
              {token.isNative ? (
                <Badge variant="default" className="gap-1">
                  <Star className="h-3 w-3" /> Native
                </Badge>
              ) : token.isIBC ? (
                <Badge variant="success" className="gap-1">
                  <Globe className="h-3 w-3" /> IBC
                </Badge>
              ) : (
                <Badge variant="muted" className="gap-1">
                  <Coins className="h-3 w-3" /> Token Factory
                </Badge>
              )}
            </div>
            {token.description && (
              <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
                {token.description}
              </p>
            )}
            <div className="mt-3 flex items-center gap-2 text-xs">
              <span className="text-muted-foreground font-mono">
                {shorten(token.denom, 16, 10)}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(token.denom);
                  toast.success("Denom copied");
                }}
              >
                <Copy className="h-3 w-3 text-muted-foreground hover:text-primary" />
              </button>
            </div>
          </div>
          {address && (
            <button
              onClick={() => setSendOpen(!sendOpen)}
              className="btn-3d bg-gradient-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium inline-flex items-center gap-2 shrink-0"
            >
              <Send className="h-4 w-4" /> Send {token.symbol || "Token"}
            </button>
          )}
        </div>
      </Card>

      {/* Send Form */}
      {sendOpen && (
        <Card className="card-3d p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" /> Send {token.symbol || token.displayName}
          </h3>
          {step === "form" && (
            <div className="space-y-4">
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Receiver Address
                </label>
                <input
                  value={receiver}
                  onChange={(e) => setReceiver(e.target.value)}
                  placeholder={`${defaultNetwork.prefix}1...`}
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none text-sm font-mono"
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">
                    Amount
                  </label>
                  <span className="text-[11px] text-muted-foreground">
                    Balance: {formatAmount(userBalance, { precision: 4 })}
                  </span>
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="0.00"
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none text-sm font-mono"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Fee</label>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  {(["low", "average", "high"] as FeeTier[]).map((t) => {
                    const f = estimateFee(t, 100_000);
                    return (
                      <button
                        key={t}
                        onClick={() => setTier(t)}
                        className={cn(
                          "rounded-lg border px-2 py-2 text-xs transition text-left",
                          tier === t
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/40",
                        )}
                      >
                        <div className="capitalize font-medium">{t}</div>
                        <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
                          {formatAmount(f.raw, { precision: 6 })}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <button
                onClick={handleSend}
                disabled={!address}
                className="w-full bg-gradient-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:opacity-90 shadow-glow"
              >
                {address ? "Send Token" : "Connect Wallet"}
              </button>
            </div>
          )}
          {step === "submitting" && (
            <div className="py-8 flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <div className="text-sm text-muted-foreground">Broadcasting transaction...</div>
            </div>
          )}
          {step === "done" && (
            <div className="py-4 flex flex-col items-center gap-2">
              {err ? (
                <>
                  <div className="h-10 w-10 rounded-full bg-destructive/15 grid place-items-center text-destructive">✕</div>
                  <div className="text-sm font-semibold">Transfer failed</div>
                  <p className="text-xs text-muted-foreground max-w-sm break-words">{err}</p>
                  <button onClick={() => setStep("form")} className="mt-2 px-4 py-2 border border-border rounded-lg text-sm">
                    Try again
                  </button>
                </>
              ) : (
                <>
                  <div className="h-10 w-10 rounded-full bg-success/15 grid place-items-center text-success">
                    <Check className="h-5 w-5" />
                  </div>
                  <div className="text-sm font-semibold">Transfer successful!</div>
                  {hash && (
                    <Link to="/transactions/$hash" params={{ hash }} className="text-xs font-mono text-primary hover:underline">
                      {shorten(hash, 12, 8)}
                    </Link>
                  )}
                  <button
                    onClick={() => { setStep("form"); setSendOpen(false); }}
                    className="mt-2 px-4 py-2 bg-gradient-primary text-primary-foreground rounded-lg text-sm"
                  >
                    Done
                  </button>
                </>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Stat Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Supply" value={formatAmount(token.totalSupply, { precision: 0 })} icon={<Coins className="h-5 w-5" />} />
        <StatCard label="Holders" value={totalHolders} icon={<Users className="h-5 w-5" />} />
        <StatCard label="Decimals" value={token.decimals} icon={<Info className="h-5 w-5" />} />
        <StatCard label="Symbol" value={token.symbol || "—"} icon={<Activity className="h-5 w-5" />} />
      </div>

      {/* Token Details */}
      <Card className="card-3d p-5">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Info className="h-4 w-4 text-primary" /> Token Details
        </h2>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <Row label="Display Name" value={token.displayName} />
          <Row label="Symbol" value={token.symbol || "—"} />
          <Row label="Denom" value={shorten(token.denom, 20, 10)} copyable />
          <Row label="Base Denom" value={shorten(token.base, 20, 10)} copyable />
          <Row label="Decimals" value={String(token.decimals)} />
          <Row
            label="Type"
            value={token.isNative ? "Native" : token.isIBC ? "IBC" : "Token Factory"}
          />
        </div>
      </Card>

      {/* Holders */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Holders
          </h2>
          <span className="text-xs text-muted-foreground">{totalHolders} shown</span>
        </div>
        {holdersLoading ? (
          <div className="p-5"><Skeleton className="h-12 w-full" /></div>
        ) : holders && holders.length > 0 ? (
          <div className="divide-y divide-border">
            {holders.map((holder: any, i: number) => (
              <Link
                key={holder.address}
                to="/accounts/$address"
                params={{ address: holder.address }}
                className="flex items-center justify-between px-5 py-3 hover:bg-accent/30 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground tabular-nums w-6">{i + 1}</span>
                  <span className="font-mono text-xs">{shorten(holder.address, 16, 8)}</span>
                </div>
                <span className="font-mono text-xs">
                  {formatAmount(holder.balance?.amount ?? "0", { precision: 4 })}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            No holders found
          </div>
        )}
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <Card className="card-3d p-4 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="text-primary/70">{icon}</span>
      </div>
      <div className="text-xl font-bold">{value}</div>
    </Card>
  );
}

function Row({
  label,
  value,
  copyable,
}: {
  label: string;
  value: string;
  copyable?: boolean;
}) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-border/40 last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs">{value}</span>
        {copyable && value !== "—" && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(value);
              toast.success("Copied");
            }}
          >
            <Copy className="h-3 w-3 text-muted-foreground hover:text-primary" />
          </button>
        )}
      </div>
    </div>
  );
}
