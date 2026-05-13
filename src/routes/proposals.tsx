import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lcd, safe } from "@/lib/cosmos";
import { Card, Badge, Skeleton } from "@/components/shared/ui";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/proposals")({
  head: () => ({
    meta: [{ title: "Proposals · Jay Network Explorer" }],
  }),
  component: ProposalsRouteComponent,
});

function ProposalsRouteComponent() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return path === "/proposals" ? <ProposalsPage /> : <Outlet />;
}

const STATUS_VARIANT: Record<string, any> = {
  PROPOSAL_STATUS_PASSED: "success",
  PROPOSAL_STATUS_REJECTED: "destructive",
  PROPOSAL_STATUS_VOTING_PERIOD: "default",
  PROPOSAL_STATUS_DEPOSIT_PERIOD: "warning",
  PROPOSAL_STATUS_FAILED: "destructive",
};

function statusLabel(s: string) {
  return s?.replace("PROPOSAL_STATUS_", "").replace(/_/g, " ").toLowerCase();
}

function ProposalsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["proposals"],
    queryFn: () => safe(lcd.proposals()),
    refetchInterval: 20_000,
  });
  const list = (data?.proposals ?? []) as any[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Governance Proposals</h1>
        <p className="text-sm text-muted-foreground">On-chain proposals and votes</p>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : list.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">No proposals yet</Card>
      ) : (
        <div className="grid gap-4">
          {list
            .sort((a, b) => Number(b.proposal_id) - Number(a.proposal_id))
            .map((p: any) => (
              <Link
                key={p.proposal_id}
                to="/proposals/$id"
                params={{ id: String(p.proposal_id) }}
              >
                <Card className="p-5 hover:border-primary/40 transition">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-muted-foreground font-mono">
                          #{p.proposal_id}
                        </span>
                        <Badge variant={STATUS_VARIANT[p.status] ?? "muted"}>
                          {statusLabel(p.status)}
                        </Badge>
                      </div>
                      <h3 className="font-semibold truncate">
                        {p.content?.title ?? "Untitled proposal"}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {p.content?.description}
                      </p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground hidden sm:block">
                      <div>Submit</div>
                      <div className="text-foreground/70">{fmtDate(p.submit_time)}</div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
        </div>
      )}
    </div>
  );
}
