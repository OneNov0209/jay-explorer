import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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

type TabFilter = "all" | "voting" | "passed" | "rejected";

function ProposalsPage() {
  const [tab, setTab] = useState<TabFilter>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["proposals"],
    queryFn: () => safe(lcd.proposals()),
    refetchInterval: 20_000,
  });
  const list = (data?.proposals ?? []) as any[];

  const filtered = useMemo(() => {
    if (tab === "all") return list;
    if (tab === "voting")
      return list.filter(
        (p: any) => p.status === "PROPOSAL_STATUS_VOTING_PERIOD" || p.status === "PROPOSAL_STATUS_DEPOSIT_PERIOD",
      );
    if (tab === "passed")
      return list.filter((p: any) => p.status === "PROPOSAL_STATUS_PASSED");
    if (tab === "rejected")
      return list.filter(
        (p: any) => p.status === "PROPOSAL_STATUS_REJECTED" || p.status === "PROPOSAL_STATUS_FAILED",
      );
    return list;
  }, [list, tab]);

  const counts = useMemo(() => {
    const voting = list.filter(
      (p: any) => p.status === "PROPOSAL_STATUS_VOTING_PERIOD" || p.status === "PROPOSAL_STATUS_DEPOSIT_PERIOD",
    ).length;
    const passed = list.filter((p: any) => p.status === "PROPOSAL_STATUS_PASSED").length;
    const rejected = list.filter(
      (p: any) => p.status === "PROPOSAL_STATUS_REJECTED" || p.status === "PROPOSAL_STATUS_FAILED",
    ).length;
    return { voting, passed, rejected };
  }, [list]);

  const tabs: { key: TabFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: list.length },
    { key: "voting", label: "Voting", count: counts.voting },
    { key: "passed", label: "Passed", count: counts.passed },
    { key: "rejected", label: "Rejected", count: counts.rejected },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Governance Proposals</h1>
        <p className="text-sm text-muted-foreground">On-chain proposals and votes</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted/30 rounded-lg w-fit text-xs">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-md font-medium transition ${
              tab === t.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">No proposals found</Card>
      ) : (
        <div className="grid gap-4">
          {filtered
            .sort((a, b) => Number(b.id || b.proposal_id) - Number(a.id || a.proposal_id))
            .map((p: any) => (
              <Link
                key={p.id || p.proposal_id}
                to="/proposals/$id"
                params={{ id: String(p.id || p.proposal_id) }}
              >
                <Card className="p-5 hover:border-primary/40 transition">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-muted-foreground font-mono">
                          #{p.id || p.proposal_id}
                        </span>
                        <Badge variant={STATUS_VARIANT[p.status] ?? "muted"}>
                          {statusLabel(p.status)}
                        </Badge>
                      </div>
                      <h3 className="font-semibold truncate">
                        {p.title ?? "Untitled proposal"}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {p.summary}
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
