import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lcd, safe } from "@/lib/cosmos";
import { Card, Badge, Skeleton } from "@/components/shared/ui";
import { formatAmount, fmtDate, pct, shorten, timeAgo } from "@/lib/format";
import { useWallet } from "@/lib/wallet";
import { useState } from "react";
import { VoteDialog, DepositDialog } from "@/components/tx/VoteClaimDialogs";

export const Route = createFileRoute("/proposals/$id")({
  head: ({ params }) => ({
    meta: [{ title: `Proposal #${params.id} · Jay Network Explorer` }],
  }),
  component: ProposalDetail,
});

const VOTE_LABELS: Record<string, { label: string; color: string }> = {
  VOTE_OPTION_YES: { label: "Yes", color: "bg-success" },
  VOTE_OPTION_NO: { label: "No", color: "bg-destructive" },
  VOTE_OPTION_NO_WITH_VETO: { label: "No With Veto", color: "bg-warning" },
  VOTE_OPTION_ABSTAIN: { label: "Abstain", color: "bg-muted-foreground" },
};

function ProposalDetail() {
  const { id } = Route.useParams();
  const { address, connect } = useWallet();
  const [voteOpen, setVoteOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["proposal", id],
    queryFn: () => safe(lcd.proposal(id)),
    refetchInterval: 15_000,
  });
  const { data: tally } = useQuery({
    queryKey: ["tally", id],
    queryFn: () => safe(lcd.proposalTally(id)),
    refetchInterval: 10_000,
  });
  const { data: votesData } = useQuery({
    queryKey: ["proposalVotes", id],
    queryFn: () => safe(lcd.proposalVotes(id)),
    refetchInterval: 15_000,
  });
  const { data: depositsData } = useQuery({
    queryKey: ["proposalDeposits", id],
    queryFn: () => safe(lcd.proposalDeposits(id)),
    refetchInterval: 15_000,
  });
  const { data: tallyParams } = useQuery({
    queryKey: ["govParams", "tallying"],
    queryFn: () => safe(lcd.govParams("tallying")),
    staleTime: 5 * 60_000,
  });
  const { data: depositParams } = useQuery({
    queryKey: ["govParams", "deposit"],
    queryFn: () => safe(lcd.govParams("deposit")),
    staleTime: 5 * 60_000,
  });
  const { data: pool } = useQuery({
    queryKey: ["pool"],
    queryFn: () => safe(lcd.pool()),
    refetchInterval: 30_000,
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  const p = (data as any)?.proposal;
  if (!p)
    return <Card className="p-8 text-center text-muted-foreground">Proposal not found.</Card>;

  const t = (tally as any)?.tally ?? p.final_tally_result ?? {};
  const yes = Number(t.yes ?? 0);
  const no = Number(t.no ?? 0);
  const abstain = Number(t.abstain ?? 0);
  const veto = Number(t.no_with_veto ?? 0);
  const total = yes + no + abstain + veto;

  const inVoting = p.status === "PROPOSAL_STATUS_VOTING_PERIOD";
  const inDeposit = p.status === "PROPOSAL_STATUS_DEPOSIT_PERIOD";

  const votes = ((votesData as any)?.votes ?? []) as any[];
  const deposits = ((depositsData as any)?.deposits ?? []) as any[];

  // Tallying params
  const tp = (tallyParams as any)?.tally_params ?? {};
  const quorumRatio = Number(tp.quorum ?? 0);
  const thresholdRatio = Number(tp.threshold ?? 0);
  const vetoRatio = Number(tp.veto_threshold ?? 0);

  // Bonded tokens for quorum calc
  const bonded = Number((pool as any)?.pool?.bonded_tokens ?? 0);
  const quorumPct = bonded ? total / bonded : 0;
  const yesNoVeto = yes + no + veto;
  const yesPct = yesNoVeto ? yes / yesNoVeto : 0;
  const vetoPct = total ? veto / total : 0;

  // Deposit params
  const dp = (depositParams as any)?.deposit_params ?? {};
  const minDepositArr = (dp.min_deposit ?? []) as any[];
  const minDepositUjay = minDepositArr[0]?.amount ?? "0";
  const currentDeposit = (p.total_deposit ?? []).reduce(
    (a: number, c: any) => a + Number(c.amount ?? 0),
    0,
  );
  const depositPct = Number(minDepositUjay) ? Math.min(currentDeposit / Number(minDepositUjay), 1) : 0;

  const openVote = () => {
    if (!address) return connect();
    setVoteOpen(true);
  };
  const openDeposit = () => {
    if (!address) return connect();
    setDepositOpen(true);
  };

  return (
    <div className="space-y-6">
      <VoteDialog
        open={voteOpen}
        onOpenChange={setVoteOpen}
        proposalId={String(p.proposal_id)}
        proposalTitle={p.content?.title}
      />
      <DepositDialog
        open={depositOpen}
        onOpenChange={setDepositOpen}
        proposalId={String(p.proposal_id)}
        proposalTitle={p.content?.title}
        minDepositUjay={minDepositUjay}
        currentDepositUjay={String(currentDeposit)}
      />

      <Card className="p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted-foreground font-mono">#{p.proposal_id}</div>
            <h1 className="text-2xl font-bold mt-1">{p.content?.title}</h1>
            <Badge className="mt-2" variant={inVoting ? "default" : inDeposit ? "warning" : "muted"}>
              {p.status?.replace("PROPOSAL_STATUS_", "").replace(/_/g, " ").toLowerCase()}
            </Badge>
          </div>
          <div className="flex gap-2">
            {inDeposit && (
              <button
                onClick={openDeposit}
                className="border border-primary/40 text-primary rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary/10"
              >
                Deposit
              </button>
            )}
            {inVoting && (
              <button
                onClick={openVote}
                className="bg-gradient-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium shadow-glow hover:opacity-90"
              >
                Vote Now
              </button>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-4 whitespace-pre-line">
          {p.content?.description}
        </p>
      </Card>

      {/* Deposit progress for DEPOSIT_PERIOD */}
      {inDeposit && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Deposit Progress</h2>
            <span className="text-xs text-muted-foreground font-mono">
              {formatAmount(currentDeposit)} / {formatAmount(minDepositUjay)}
            </span>
          </div>
          <div className="h-3 bg-muted/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-primary transition-all"
              style={{ width: `${depositPct * 100}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground mt-2">{pct(depositPct)} of minimum reached</div>
        </Card>
      )}

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Tally</h2>
          <span className="text-xs text-muted-foreground">Auto-refresh 10s</span>
        </div>
        <div className="space-y-3">
          {[
            { k: yes, label: "Yes", color: "bg-success" },
            { k: no, label: "No", color: "bg-destructive" },
            { k: veto, label: "No With Veto", color: "bg-warning" },
            { k: abstain, label: "Abstain", color: "bg-muted-foreground" },
          ].map((o) => {
            const ratio = total ? o.k / total : 0;
            return (
              <div key={o.label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span>{o.label}</span>
                  <span className="font-mono text-muted-foreground">
                    {formatAmount(o.k)} · {pct(ratio)}
                  </span>
                </div>
                <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                  <div className={`h-full ${o.color}`} style={{ width: `${ratio * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Quorum / Threshold */}
        {(quorumRatio > 0 || thresholdRatio > 0) && (
          <div className="mt-6 grid sm:grid-cols-3 gap-4">
            <ThresholdMeter
              label="Quorum"
              current={quorumPct}
              required={quorumRatio}
            />
            <ThresholdMeter
              label="Yes Threshold"
              current={yesPct}
              required={thresholdRatio}
            />
            <ThresholdMeter
              label="Veto Threshold"
              current={vetoPct}
              required={vetoRatio}
              invert
            />
          </div>
        )}
      </Card>

      <Card className="p-6 space-y-2 text-sm">
        <Row label="Submit Time">{fmtDate(p.submit_time)}</Row>
        <Row label="Deposit End">{fmtDate(p.deposit_end_time)}</Row>
        <Row label="Voting Start">{fmtDate(p.voting_start_time)}</Row>
        <Row label="Voting End">
          {fmtDate(p.voting_end_time)}{" "}
          {inVoting && (
            <span className="text-muted-foreground text-xs">({timeAgo(p.voting_end_time)})</span>
          )}
        </Row>
        <Row label="Total Deposit">{formatAmount(currentDeposit)}</Row>
      </Card>

      {/* Voters */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Voters ({votes.length})</h2>
          <span className="text-xs text-muted-foreground">Auto-refresh 15s</span>
        </div>
        {votes.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">No votes yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="text-left py-2 font-medium">Voter</th>
                  <th className="text-left py-2 font-medium">Option</th>
                </tr>
              </thead>
              <tbody>
                {votes.slice(0, 100).map((v, i) => {
                  const opt =
                    v.option && v.option !== "VOTE_OPTION_UNSPECIFIED"
                      ? VOTE_LABELS[v.option]
                      : v.options?.[0]?.option
                        ? VOTE_LABELS[v.options[0].option]
                        : null;
                  return (
                    <tr key={i} className="border-b border-border/50 last:border-0">
                      <td className="py-2 font-mono text-xs">
                        <Link
                          to="/accounts/$address"
                          params={{ address: v.voter }}
                          className="text-primary hover:underline"
                        >
                          {shorten(v.voter, 14, 8)}
                        </Link>
                      </td>
                      <td className="py-2">
                        {opt ? (
                          <span className="inline-flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${opt.color}`} />
                            {opt.label}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Depositors */}
      {deposits.length > 0 && (
        <Card className="p-6">
          <h2 className="font-semibold mb-4">Depositors ({deposits.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="text-left py-2 font-medium">Depositor</th>
                  <th className="text-right py-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {deposits.map((d, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0">
                    <td className="py-2 font-mono text-xs">
                      <Link
                        to="/accounts/$address"
                        params={{ address: d.depositor }}
                        className="text-primary hover:underline"
                      >
                        {shorten(d.depositor, 14, 8)}
                      </Link>
                    </td>
                    <td className="py-2 text-right font-mono">
                      {formatAmount(d.amount?.[0]?.amount ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function ThresholdMeter({
  label,
  current,
  required,
  invert,
}: {
  label: string;
  current: number;
  required: number;
  invert?: boolean;
}) {
  const pass = invert ? current < required : current >= required;
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-muted-foreground">{label}</span>
        <Badge variant={pass ? "success" : "muted"} className="text-[10px]">
          {pass ? "PASS" : "PENDING"}
        </Badge>
      </div>
      <div className="text-sm font-mono">
        {pct(current)} <span className="text-muted-foreground">/ {pct(required)}</span>
      </div>
      <div className="mt-2 h-1.5 bg-muted/40 rounded-full overflow-hidden">
        <div
          className={`h-full ${pass ? "bg-success" : "bg-primary"}`}
          style={{ width: `${Math.min(current / Math.max(required, 0.0001), 1) * 100}%` }}
        />
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-1 sm:gap-4 py-1">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div>{children}</div>
    </div>
  );
}
