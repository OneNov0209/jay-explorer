import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Card, Badge, Skeleton } from "@/components/shared/ui";
import { defaultNetwork } from "@/data/networks";
import { formatNumber, shorten } from "@/lib/format";
import { Globe, GitBranch, ArrowRightLeft, Search, ExternalLink, Activity } from "lucide-react";

export const Route = createFileRoute("/ibc")({
  head: () => ({
    meta: [
      { title: "IBC · Jay Network Explorer" },
      { name: "description", content: "IBC connections, channels, and transfers on Jay Network." },
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

function IbcPage() {
  const [tab, setTab] = useState<"connections" | "channels" | "transfer">("connections");
  const [searchQ, setSearchQ] = useState("");

  // Fetch IBC paths dari Chain Registry
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
            const [from, rest] = f.name.replace(".json", "").split("-thejaynetwork");
            return {
              from: from || rest || "unknown",
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

  // Fetch channel details dari on-chain LCD
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

      {/* Tab: Connections */}
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

      {/* Tab: Channels */}
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
                      <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">
                        No channels found
                      </td>
                    </tr>
                  ) : (
                    filteredChannels.map((ch) => (
                      <tr
                        key={ch.channel_id + ch.port_id}
                        className="border-t border-border hover:bg-accent/30 transition"
                      >
                        <td className="px-5 py-3 font-mono text-xs">{ch.channel_id}</td>
                        <td className="px-5 py-3 font-mono text-xs">{ch.port_id}</td>
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

      {/* Tab: Transfer — placeholder, nanti diinstruksikan */}
      {tab === "transfer" && (
        <Card className="p-10 text-center text-muted-foreground text-sm">
          IBC Transfer form will be added here. Stay tuned.
        </Card>
      )}
    </div>
  );
}
