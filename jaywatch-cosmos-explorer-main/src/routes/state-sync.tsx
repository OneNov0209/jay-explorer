import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { rpc, safe } from "@/lib/cosmos";
import { defaultNetwork } from "@/data/networks";
import { Card } from "@/components/shared/ui";
import { CopyButton } from "@/components/shared/CopyButton";
import { RefreshCw, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/state-sync")({
  head: () => ({
    meta: [{ title: "State Sync · Jay Network Explorer" }],
  }),
  component: StateSyncPage,
});

const TRUST_OFFSET = 2000;

function StateSyncPage() {
  const { data: status } = useQuery({
    queryKey: ["statesync-status"],
    queryFn: () => safe(rpc.status()),
    refetchInterval: defaultNetwork.blockTime * 1000,
    placeholderData: keepPreviousData,
  });

  const latestHeight = Number(
    (status as any)?.result?.sync_info?.latest_block_height ?? 0,
  );
  const latestHash = (status as any)?.result?.sync_info?.latest_block_hash as
    | string
    | undefined;
  const catchingUp = !!(status as any)?.result?.sync_info?.catching_up;

  const trustHeight = useMemo(
    () => (latestHeight > TRUST_OFFSET ? latestHeight - TRUST_OFFSET : Math.max(1, latestHeight - 100)),
    [latestHeight],
  );

  const { data: trustBlock } = useQuery({
    queryKey: ["statesync-trust-block", trustHeight],
    queryFn: () => safe(rpc.block(trustHeight)),
    enabled: trustHeight > 0,
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
  });
  const trustHash =
    (trustBlock as any)?.result?.block_id?.hash ?? "";

  const rpcServers = defaultNetwork.rpcs.slice(0, 2).join(",");

  const configSnippet = `[statesync]
enable = true

rpc_servers = "${rpcServers}"
trust_height = ${trustHeight}
trust_hash = "${trustHash}"
trust_period = "168h"

discovery_time = "15s"
temp_dir = ""
chunk_request_timeout = "10s"
chunk_fetchers = "4"`;

  const oneLiner = `SNAP_RPC="${defaultNetwork.rpcs[0]}"
TRUST_HEIGHT=${trustHeight}
TRUST_HASH="${trustHash}"

sed -i.bak -E "s|^(enable[[:space:]]+=[[:space:]]+).*$|\\1true| ; \
s|^(rpc_servers[[:space:]]+=[[:space:]]+).*$|\\1\\"$SNAP_RPC,$SNAP_RPC\\"| ; \
s|^(trust_height[[:space:]]+=[[:space:]]+).*$|\\1$TRUST_HEIGHT| ; \
s|^(trust_hash[[:space:]]+=[[:space:]]+).*$|\\1\\"$TRUST_HASH\\"| ; \
s|^(trust_period[[:space:]]+=[[:space:]]+).*$|\\1\\"168h0m0s\\"|" $HOME/.${defaultNetwork.chainId}/config/config.toml`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <RefreshCw className="h-6 w-6 text-primary" />
          State Sync
        </h1>
        <p className="text-sm text-muted-foreground">
          Live trust height & hash for {defaultNetwork.displayName}. Use these
          values to bootstrap a new node in seconds.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="card-3d p-5">
          <div className="text-xs text-muted-foreground">Latest Block</div>
          <div className="mt-1 text-2xl font-bold text-mono">
            {latestHeight ? `#${latestHeight.toLocaleString()}` : "—"}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                !catchingUp ? "bg-emerald-400 animate-pulse-dot" : "bg-amber-400"
              }`}
            />
            <span className="text-muted-foreground">
              {!catchingUp ? "Synced" : "Catching up"}
            </span>
          </div>
        </Card>

        <Card className="card-3d p-5">
          <div className="text-xs text-muted-foreground">Trust Height</div>
          <div className="mt-1 text-2xl font-bold text-mono text-primary">
            #{trustHeight.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            latest − {TRUST_OFFSET.toLocaleString()}
          </div>
        </Card>

        <Card className="card-3d p-5">
          <div className="text-xs text-muted-foreground">Chain ID</div>
          <div className="mt-1 text-2xl font-bold text-mono">
            {defaultNetwork.chainId}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> mainnet
          </div>
        </Card>
      </div>

      <Card className="p-5 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Latest Block Hash
            </span>
            {latestHash && <CopyButton value={latestHash} />}
          </div>
          <div className="text-mono text-sm break-all rounded-md bg-muted/40 px-3 py-2 border">
            {latestHash || "—"}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Trust Hash <span className="text-primary">(height {trustHeight.toLocaleString()})</span>
            </span>
            {trustHash && <CopyButton value={trustHash} />}
          </div>
          <div className="text-mono text-sm break-all rounded-md bg-muted/40 px-3 py-2 border">
            {trustHash || "—"}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              RPC Servers
            </span>
            <CopyButton value={rpcServers} />
          </div>
          <div className="text-mono text-sm break-all rounded-md bg-muted/40 px-3 py-2 border">
            {rpcServers}
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">config.toml — [statesync]</h2>
          <CopyButton value={configSnippet} />
        </div>
        <pre className="text-mono text-xs leading-relaxed overflow-x-auto rounded-md bg-muted/40 p-4 border">
          {configSnippet}
        </pre>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">One-liner (sed patch)</h2>
          <CopyButton value={oneLiner} />
        </div>
        <pre className="text-mono text-xs leading-relaxed overflow-x-auto rounded-md bg-muted/40 p-4 border whitespace-pre-wrap">
          {oneLiner}
        </pre>
        <p className="mt-3 text-xs text-muted-foreground">
          Run on the target node, then start with{" "}
          <code className="text-mono text-foreground">--x-crisis-skip-assert-invariants</code>.
          Trust values refresh live from RPC.
        </p>
      </Card>
    </div>
  );
}
