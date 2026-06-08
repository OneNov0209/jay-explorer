import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Card, Badge, Skeleton } from "@/components/shared/ui";
import { useWallet } from "@/lib/wallet";
import { defaultNetwork } from "@/data/networks";
import { lcd, safe } from "@/lib/cosmos";
import { ibcTransfer, estimateFee, type FeeTier } from "@/lib/tx";
import { formatAmount, formatNumber, shorten } from "@/lib/format";
import {
  Globe,
  GitBranch,
  ArrowRightLeft,
  Search,
  ExternalLink,
  Activity,
  ArrowRight,
  Check,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ibc")({
  head: () => ({
    meta: [
      { title: "IBC · Jay Network Explorer" },
      {
        name: "description",
        content: "IBC connections, channels, and transfers on Jay Network.",
      },
    ],
  }),
  component: IbcRouteComponent,
});

function IbcRouteComponent() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return path === "/ibc" ? <IbcPage /> : <Outlet />;
}

interface IbcPath {
  from: string;
  to: string;
  path: string;
}

interface IbcChannel {
  chain_name: string;
  display_name: string;
  logo: string;
  channel_id: string;
  port_id: string;
  state: string;
  counterparty_channel: string;
  counterparty_port: string;
  ordering: string;
  version: string;
  hops: string[];
}

interface IbcTransferChannel {
  chain_name: string;
  display_name: string;
  logo: string;
  channel_id: string;
  prefix: string;
  counter_chain_id: string;
}

const DECIMALS = defaultNetwork.tokenDecimals;

function toMicro(human: string): string {
  if (!human) return "0";
  const [w, f = ""] = human.split(".");
  const frac = (f + "0".repeat(DECIMALS)).slice(0, DECIMALS);
  return BigInt(w || "0") * BigInt(10 ** DECIMALS) + BigInt(frac || "0") + "";
}

function IbcPage() {
  const [tab, setTab] = useState<"connections" | "channels" | "transfer">("connections");
  const [searchQ, setSearchQ] = useState("");

  // ============================================================
  // DATA: Connections (Chain Registry)
  // ============================================================
  const { data: ibcPaths, isLoading: pathsLoading } = useQuery({
    queryKey: ["ibc-paths"],
    queryFn: async (): Promise<IbcPath[]> => {
      try {
        const res = await fetch(
          "https://api.github.com/repos/cosmos/chain-registry/contents/_IBC",
        );
        if (!res.ok) return [];
        const files: Array<{ name: string }> = await res.json();
        return files
          .filter((f) => f.name.includes("thejaynetwork"))
          .map((f) => {
            const [from] = f.name.replace(".json", "").split("-thejaynetwork");
            return {
              from: from || "unknown",
              to: "thejaynetwork",
              path: f.name.replace(".json", ""),
            };
          });
      } catch {
        return [];
      }
    },
    staleTime: 30 * 60_000,
    refetchInterval: 30 * 60_000,
  });

  // ============================================================
  // DATA: Channels (On-chain LCD)
  // ============================================================
  const { data: channels, isLoading: channelsLoading } = useQuery({
    queryKey: ["ibc-channels-onchain"],
    queryFn: async (): Promise<IbcChannel[]> => {
      try {
        const lcdUrl = defaultNetwork.apis[0];
        const res = await fetch(
          `${lcdUrl}/ibc/core/channel/v1/channels?pagination.limit=200`,
        );
        if (!res.ok) return [];
        const data = await res.json();
        return (data.channels ?? []).map((ch: any) => ({
          chain_name: "",
          display_name: "",
          logo: "",
          channel_id: ch.channel_id,
          port_id: ch.port_id,
          state: ch.state,
          counterparty_channel: ch.counterparty?.channel_id || "—",
          counterparty_port: ch.counterparty?.port_id || "—",
          ordering: ch.ordering,
          version: ch.version,
          hops: ch.connection_hops || [],
        }));
      } catch {
        return [];
      }
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const filteredChannels = useMemo(() => {
    if (!channels) return [];
    if (!searchQ) return channels;
    const q = searchQ.toLowerCase();
    return channels.filter(
      (c) =>
        c.channel_id.toLowerCase().includes(q) ||
        c.port_id.toLowerCase().includes(q) ||
        c.counterparty_channel.toLowerCase().includes(q),
    );
  }, [channels, searchQ]);

  // ============================================================
  // DATA: Transfer channels (Chain Registry — buat dropdown)
  // ============================================================
  const { data: transferChannels, isLoading: transferChannelsLoading } = useQuery({
    queryKey: ["ibc-transfer-channels"],
    queryFn: async (): Promise<IbcTransferChannel[]> => {
      try {
        const listRes = await fetch(
          "https://api.github.com/repos/cosmos/chain-registry/contents/_IBC",
        );
        if (!listRes.ok) return [];
        const files: Array<{ name: string }> = await listRes.json();
        const jayFiles = files.filter((f: { name: string }) =>
          f.name.includes("thejaynetwork"),
        );

        const result: IbcTransferChannel[] = [];

        for (const file of jayFiles) {
          try {
            const res = await fetch(
              `https://raw.githubusercontent.com/cosmos/chain-registry/master/_IBC/${file.name}`,
            );
            if (!res.ok) continue;
            const data = await res.json();

            const jayKey =
              data.chain_1?.chain_name === "thejaynetwork" ? "chain_1" : "chain_2";
            const counterKey = jayKey === "chain_1" ? "chain_2" : "chain_1";

            const jayChannel = data[jayKey]?.channel_id;
            const counterChain = data[counterKey]?.chain_name;

            if (!jayChannel || !counterChain) continue;

            let displayName = counterChain;
            let logo = "";
            let prefix = "";

            try {
              const chainRes = await fetch(
                `https://raw.githubusercontent.com/cosmos/chain-registry/master/${counterChain}/chain.json`,
              );
              if (chainRes.ok) {
                const chainData = await chainRes.json();
                displayName =
                  chainData?.pretty_name || chainData?.chain_name || counterChain;
                logo =
                  chainData?.images?.[0]?.png ||
                  chainData?.images?.[0]?.svg ||
                  "";
              }
            } catch {}

            try {
              const assetRes = await fetch(
                `https://raw.githubusercontent.com/cosmos/chain-registry/master/${counterChain}/assetlist.json`,
              );
              if (assetRes.ok) {
                const assetData = await assetRes.json();
                prefix = assetData?.assets?.[0]?.address?.split("1")[0] || "";
              }
            } catch {}

            result.push({
              chain_name: counterChain,
              display_name: displayName || counterChain,
              logo,
              channel_id: jayChannel,
              prefix: prefix || counterChain.slice(0, 4),
              counter_chain_id: data[counterKey]?.chain_id || "",
            });
          } catch {}
        }

        return result.sort((a, b) =>
          a.display_name.localeCompare(b.display_name),
        );
      } catch {
        return [];
      }
    },
    staleTime: 30 * 60_000,
    refetchInterval: 30 * 60_000,
    placeholderData: (prev) => prev,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-primary/15 grid place-items-center text-primary ring-2 ring-primary/30">
          <Globe className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">IBC</h1>
          <p className="text-xs text-muted-foreground">
            Inter-Blockchain Communication — Connections, Channels & Transfers
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted/30 rounded-lg w-fit text-xs">
        {(["connections", "channels", "transfer"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md font-medium capitalize transition ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ============================================================ */}
      {/* TAB: Connections */}
      {/* ============================================================ */}
      {tab === "connections" && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-primary" /> IBC Connections
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              From Cosmos Chain Registry
            </p>
          </div>
          {pathsLoading ? (
            <div className="p-5">
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {ibcPaths?.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                  No IBC connections found
                </div>
              ) : (
                ibcPaths?.map((p) => (
                  <Link
                    key={p.path}
                    to="/ibc/connection/$id"
                    params={{ id: p.path }}
                    className="flex items-center justify-between px-5 py-3 hover:bg-accent/30 transition"
                  >
                    <div className="flex items-center gap-3">
                      <Activity className="h-4 w-4 text-success" />
                      <div>
                        <span className="font-medium capitalize">{p.from}</span>
                        <span className="text-muted-foreground mx-2">⇄</span>
                        <span className="font-medium">Jay Network</span>
                      </div>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                ))
              )}
            </div>
          )}
        </Card>
      )}

      {/* ============================================================ */}
      {/* TAB: Channels */}
      {/* ============================================================ */}
      {tab === "channels" && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="font-semibold flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-primary" /> IBC Channels
            </h2>
            <div className="relative w-full sm:w-64">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Search channels..."
                className="w-full pl-10 pr-3 h-8 text-xs rounded-lg bg-card border border-border focus:border-primary focus:outline-none"
              />
            </div>
          </div>
          {channelsLoading ? (
            <div className="p-5">
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium">Channel</th>
                    <th className="text-left px-5 py-3 font-medium">Port</th>
                    <th className="text-left px-5 py-3 font-medium">State</th>
                    <th className="text-left px-5 py-3 font-medium">Counterparty</th>
                    <th className="text-left px-5 py-3 font-medium">Hops</th>
                    <th className="text-left px-5 py-3 font-medium">Version</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredChannels.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-5 py-10 text-center text-muted-foreground"
                      >
                        No channels found
                      </td>
                    </tr>
                  ) : (
                    filteredChannels.map((ch) => (
                      <tr
                        key={ch.channel_id + ch.port_id}
                        className="border-t border-border hover:bg-accent/30 transition"
                      >
                        <td className="px-5 py-3 font-mono text-xs">
                          {ch.channel_id}
                        </td>
                        <td className="px-5 py-3 font-mono text-xs">
                          {ch.port_id}
                        </td>
                        <td className="px-5 py-3">
                          <Badge
                            variant={
                              ch.state.includes("OPEN") ? "success" : "warning"
                            }
                          >
                            {ch.state.replace("STATE_", "")}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                          {ch.counterparty_port}/{ch.counterparty_channel}
                        </td>
                        <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                          {ch.hops.join(", ")}
                        </td>
                        <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                          {ch.version}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ============================================================ */}
      {/* TAB: Transfer */}
      {/* ============================================================ */}
      {tab === "transfer" && (
        <IbcTransferForm transferChannels={transferChannels} isLoading={transferChannelsLoading} />
      )}
    </div>
  );
}

// ============================================================
// IBC TRANSFER FORM COMPONENT
// ============================================================
function IbcTransferForm({
  transferChannels,
  isLoading,
}: {
  transferChannels?: IbcTransferChannel[];
  isLoading: boolean;
}) {
  const { address, connect } = useWallet();
  const [channel, setChannel] = useState("");
  const [receiver, setReceiver] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [tier, setTier] = useState<FeeTier>("average");
  const [step, setStep] = useState<"form" | "submitting" | "done">("form");
  const [hash, setHash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState("");

  const { data: bal } = useQuery({
    queryKey: ["ibc-bal", address],
    queryFn: () => safe(lcd.balance(address!)),
    enabled: !!address,
    refetchInterval: 15_000,
  });
  const available =
    bal?.balances?.find((b: any) => b.denom === defaultNetwork.denom)?.amount ?? "0";

  const filteredChannels = useMemo(() => {
    if (!transferChannels) return [];
    if (!searchQ) return transferChannels;
    const q = searchQ.toLowerCase();
    return transferChannels.filter(
      (c) =>
        c.display_name.toLowerCase().includes(q) ||
        c.chain_name.toLowerCase().includes(q) ||
        c.channel_id.toLowerCase().includes(q),
    );
  }, [transferChannels, searchQ]);

  const selectedChannel = transferChannels?.find((c) => c.channel_id === channel);

  const fee = estimateFee(tier, 250_000);

  const submit = async () => {
    if (!address) return connect();
    if (!channel) return toast.error("Select a destination chain");
    if (!receiver || receiver.length < 10) return toast.error("Invalid receiver");
    if (!amount || Number(amount) <= 0) return toast.error("Enter amount");
    setStep("submitting");
    setErr(null);
    try {
      const res = await ibcTransfer(
        {
          sender: address,
          receiver,
          amountUjay: toMicro(amount),
          sourceChannel: channel,
          memo,
        },
        tier,
      );
      if (res.code && res.code !== 0)
        throw new Error(res.rawLog || `Code ${res.code}`);
      setHash(res.transactionHash);
      setStep("done");
      toast.success("IBC transfer broadcasted");
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      setStep("done");
      toast.error("IBC transfer failed", { description: e?.message });
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card className="p-6">
        {step === "form" && (
          <div className="space-y-4">
            {/* Destination Chain */}
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                Destination Chain
              </label>
              {isLoading ? (
                <Skeleton className="mt-1 h-10 w-full rounded-lg" />
              ) : (
                <>
                  <div className="relative mt-1">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={searchQ}
                      onChange={(e) => setSearchQ(e.target.value)}
                      placeholder="Search chain..."
                      className="w-full pl-10 pr-3 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none text-sm"
                    />
                  </div>
                  <div className="mt-2 max-h-48 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                    {filteredChannels.length === 0 ? (
                      <div className="p-4 text-center text-xs text-muted-foreground">
                        No IBC channels found. Try manual input below.
                      </div>
                    ) : (
                      filteredChannels.map((c) => (
                        <button
                          key={c.channel_id}
                          type="button"
                          onClick={() => {
                            setChannel(c.channel_id);
                            setSearchQ("");
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 text-left transition hover:bg-accent/30",
                            channel === c.channel_id &&
                              "bg-primary/10 border-l-2 border-primary",
                          )}
                        >
                          {c.logo ? (
                            <img
                              src={c.logo}
                              alt={c.display_name}
                              className="h-6 w-6 rounded-full shrink-0"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="h-6 w-6 rounded-full bg-primary/15 grid place-items-center text-primary shrink-0">
                              <Globe className="h-3.5 w-3.5" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">
                              {c.display_name}
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono truncate">
                              {c.channel_id} · receiver: {c.prefix}1…
                            </div>
                          </div>
                          {channel === c.channel_id && (
                            <Check className="h-4 w-4 text-primary shrink-0" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Source Channel */}
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                Source Channel
              </label>
              <input
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                placeholder="channel-0"
                className="mt-1 w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none text-sm font-mono"
              />
            </div>

            {/* Receiver */}
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                Receiver Address (destination chain)
              </label>
              <input
                value={receiver}
                onChange={(e) => setReceiver(e.target.value)}
                placeholder={
                  selectedChannel
                    ? `${selectedChannel.prefix}1…`
                    : "cosmos1... / osmo1..."
                }
                className="mt-1 w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none text-sm font-mono"
              />
            </div>

            {/* Amount */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Amount ({defaultNetwork.coinDenom})
                </label>
                <span className="text-[11px] text-muted-foreground">
                  Available: {formatAmount(available)}
                </span>
              </div>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) =>
                  setAmount(e.target.value.replace(/[^0-9.]/g, ""))
                }
                placeholder="0.00"
                className="mt-1 w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none text-sm font-mono"
              />
            </div>

            {/* Fee */}
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                Fee
              </label>
              <div className="mt-1 grid grid-cols-3 gap-2">
                {(["low", "average", "high"] as FeeTier[]).map((t) => {
                  const f = estimateFee(t, 250_000);
                  return (
                    <button
                      key={t}
                      type="button"
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

            {/* Memo */}
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                Memo (optional)
              </label>
              <input
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none text-sm"
              />
            </div>

            {/* Summary */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs space-y-1">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">From</span>
                <span className="text-foreground/90 truncate max-w-[60%] font-mono">
                  {shorten(address ?? "—", 12, 8)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">To</span>
                <span className="text-foreground/90 truncate max-w-[60%] font-mono">
                  {shorten(receiver || "—", 12, 8)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Destination</span>
                <span className="text-foreground/90 truncate max-w-[60%] font-mono">
                  {selectedChannel ? selectedChannel.display_name : channel || "—"}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Channel</span>
                <span className="text-foreground/90 truncate max-w-[60%] font-mono">
                  {channel || "—"}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Amount</span>
                <span className="text-foreground/90 truncate max-w-[60%] font-mono">
                  {amount || "0"} {defaultNetwork.coinDenom}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Network Fee</span>
                <span className="text-foreground/90 truncate max-w-[60%] font-mono">
                  {formatAmount(fee.raw, { precision: 6 })}
                </span>
              </div>
            </div>

            <button
              onClick={submit}
              disabled={!channel || !receiver || !amount}
              className="w-full bg-gradient-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 shadow-glow disabled:opacity-50"
            >
              {address ? "Send via IBC" : "Connect Wallet"}{" "}
              <ArrowRight className="h-4 w-4" />
            </button>

            {/* Powered by Chain Registry */}
            <div className="text-[10px] text-muted-foreground text-center">
              IBC channel data from{" "}
              <a
                href="https://github.com/cosmos/chain-registry"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                Cosmos Chain Registry <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
          </div>
        )}

        {step === "submitting" && (
          <div className="py-12 flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <div className="text-sm text-muted-foreground text-center">
              Approve in Keplr… broadcasting IBC packet.
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="py-6 flex flex-col items-center gap-3">
            {err ? (
              <>
                <div className="h-12 w-12 rounded-full bg-destructive/15 grid place-items-center text-destructive">
                  ✕
                </div>
                <div className="text-sm font-semibold">Transfer failed</div>
                <div className="text-xs text-muted-foreground text-center max-w-md break-words">
                  {err}
                </div>
                <button
                  onClick={() => setStep("form")}
                  className="mt-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-accent/40"
                >
                  Try again
                </button>
              </>
            ) : (
              <>
                <div className="h-12 w-12 rounded-full bg-success/15 grid place-items-center text-success">
                  <Check className="h-6 w-6" />
                </div>
                <div className="text-sm font-semibold">IBC transfer sent</div>
                {hash && (
                  <a
                    href={`/transactions/${hash}`}
                    className="text-xs font-mono text-primary hover:underline break-all text-center"
                  >
                    {hash}
                  </a>
                )}
                <button
                  onClick={() => {
                    setStep("form");
                    setHash(null);
                    setErr(null);
                  }}
                  className="mt-2 px-4 py-2 rounded-lg bg-gradient-primary text-primary-foreground text-sm"
                >
                  Send another
                </button>
              </>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
