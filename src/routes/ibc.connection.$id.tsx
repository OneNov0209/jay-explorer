import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, Badge, Skeleton } from "@/components/shared/ui";
import { defaultNetwork } from "@/data/networks";
import { shorten, fmtDate } from "@/lib/format";
import { ChevronLeft, Activity, GitBranch, ArrowRightLeft } from "lucide-react";

export const Route = createFileRoute("/ibc/connection/$id")({
  head: ({ params }) => ({
    meta: [{ title: `IBC Connection ${params.id} · Jay Network Explorer` }],
  }),
  component: IbcConnectionDetail,
});

function IbcConnectionDetail() {
  const { id } = Route.useParams();

  const { data: connData, isLoading } = useQuery({
    queryKey: ["ibc-connection", id],
    queryFn: async () => {
      const res = await fetch(
        `https://raw.githubusercontent.com/cosmos/chain-registry/master/_IBC/${id}.json`,
      );
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    staleTime: 30 * 60_000,
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!connData)
    return (
      <Card className="p-10 text-center text-muted-foreground">
        Connection not found.
      </Card>
    );

  const jayKey =
    connData.chain_1?.chain_name === "thejaynetwork" ? "chain_1" : "chain_2";
  const counterKey = jayKey === "chain_1" ? "chain_2" : "chain_1";

  return (
    <div className="space-y-6">
      <Link
        to="/ibc"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition"
      >
        <ChevronLeft className="h-4 w-4" /> Back to IBC
      </Link>

      {/* Summary */}
      <Card className="card-3d p-6">
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <div className="text-center">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">
              {defaultNetwork.displayName}
            </div>
            <div className="text-sm font-mono mt-1">{connData[jayKey]?.client_id}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {connData[jayKey]?.channel_id}
            </div>
          </div>
          <div className="text-2xl text-success">⇄</div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">
              {connData[counterKey]?.chain_name}
            </div>
            <div className="text-sm font-mono mt-1">{connData[counterKey]?.client_id}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {connData[counterKey]?.channel_id}
            </div>
          </div>
        </div>
      </Card>

      {/* Channels */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-primary" /> Channels
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-5 py-3 font-medium">Jay Network</th>
                <th className="text-left px-5 py-3 font-medium">Counterparty</th>
                <th className="text-left px-5 py-3 font-medium">Port</th>
                <th className="text-left px-5 py-3 font-medium">Ordering</th>
                <th className="text-left px-5 py-3 font-medium">Version</th>
              </tr>
            </thead>
            <tbody>
              {(connData.channels ?? []).map((ch: any, i: number) => (
                <tr
                  key={i}
                  className="border-t border-border hover:bg-accent/30 transition"
                >
                  <td className="px-5 py-3 font-mono text-xs">
                    {ch[jayKey]?.channel_id}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs">
                    {ch[counterKey]?.channel_id}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs">
                    {ch[jayKey]?.port_id}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs capitalize">
                    {ch.ordering}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs">
                    {ch.version}
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
