import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lcd, safe } from "@/lib/cosmos";
import { Card, Badge, Skeleton } from "@/components/shared/ui";
import { formatAmount, fmtDate, pct, shorten, timeAgo } from "@/lib/format";
import { useWallet } from "@/lib/wallet";
import { useState } from "react";
import { VoteDialog, DepositDialog } from "@/components/tx/VoteClaimDialogs";
import {
  Clock,
  User,
  Coins,
  FileText,
  CheckCircle,
  XCircle,
  MinusCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export const Route = createFileRoute("/proposals/$id")({
  head: ({ params }) => ({
    meta: [{ title: `Proposal #${params.id} · Jay Network Explorer` }],
  }),
  component: ProposalDetail,
});

const VOTE_LABELS: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  VOTE_OPTION_YES: { label: "Yes", color: "text-success", icon: CheckCircle },
  VOTE_OPTION_NO: { label: "No", color: "text-destructive", icon: XCircle },
  VOTE_OPTION_NO_WITH_VETO: { label: "No With Veto", color: "text-warning", icon: AlertTriangle },
  VOTE_OPTION_ABSTAIN: { label: "Abstain", color: "text-muted-foreground", icon: MinusCircle },
};

function ProposalDetail() {
  const { id } = Route.useParams();
  const { address, connect } = useWallet();
  const [voteOpen, setVoteOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [showAllVoters, setShowAllVoters] = useState(false);
  const [showMessages, setShowMessages] = useState(false);

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
    return (
      <Card className="p-10 text-center">
        <div className="text-6xl mb-4">🔍</div>
        <h2 className="text-xl font-semibold mb-2">Proposal Not Found</h2>
        <p className="text-muted-foreground text-sm">
          Proposal #{id} does not exist or has been removed.
        </p>
        <Link
          to="/proposals"
          className="inline-flex mt-4 text-primary text-sm hover:underline"
        >
          ← Back to proposals
        </Link>
      </Card>
    );

  const t = (tally as any)?.tally ?? p.final_tally_result ?? {};
  const yes = Number(t.yes_count ?? t.yes ?? 0);
  const no = Number(t.no_count ?? t.no ?? 0);
  const abstain = Number(t.abstain_count ?? t.abstain ?? 0);
  const veto = Number(t.no_with_veto_count ?? t.no_with_veto ?? 0);
  const total = yes + no + abstain + veto;

  const inVoting = p.status === "PROPOSAL_STATUS_VOTING_PERIOD";
  const inDeposit = p.status === "PROPOSAL_STATUS_DEPOSIT_PERIOD";
  const passed = p.status === "PROPOSAL_STATUS_PASSED";
  const rejected = p.status === "PROPOSAL_STATUS_REJECTED";

  const votes = ((votesData as any)?.votes ?? []) as any[];
  const deposits = ((depositsData as any)?.deposits ?? []) as any[];

  const tp = (tallyParams as any)?.tally_params ?? {};
  const quorumRatio = Number(tp.quorum ?? 0);
  const thresholdRatio = Number(tp.threshold ?? 0);
  const vetoRatio = Number(tp.veto_threshold ?? 0);

  const bonded = Number((pool as any)?.pool?.bonded_tokens ?? 0);
  const quorumPct = bonded ? total / bonded : 0;
  const yesNoVeto = yes + no + veto;
  const yesPct = yesNoVeto ? yes / yesNoVeto : 0;
  const vetoPct = total ? veto / total : 0;

  const dp = (depositParams as any)?.deposit_params ?? {};
  const minDepositArr = (dp.min_deposit ?? []) as any[];
  const minDepositUjay = minDepositArr[0]?.amount ?? "0";
  const currentDeposit = (p.total_deposit ?? []).reduce(
    (a: number, c: any) => a + Number(c.amount ?? 0),
    0,
  );
  const depositPct = Number(minDepositUjay)
    ? Math.min(currentDeposit / Number(minDepositUjay), 1)
    : 0;

  const openVote = () => {
    if (!address) return connect();
    setVoteOpen(true);
  };
  const openDeposit = () => {
    if (!address) return connect();
    setDepositOpen(true);
  };

  const statusBadge = () => {
    if (passed)
      return (
        <Badge variant="success" className="gap-1">
          <CheckCircle className="h-3 w-3" /> Passed
        </Badge>
      );
    if (rejected)
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" /> Rejected
        </Badge>
      );
    if (inVoting)
      return (
        <Badge variant="default" className="gap-1">
          <Clock className="h-3 w-3 animate-pulse" /> Voting Period
        </Badge>
      );
    if (inDeposit)
      return (
        <Badge variant="warning" className="gap-1">
          <Coins className="h-3 w-3" /> Deposit Period
        </Badge>
      );
    return (
      <Badge variant="muted" className="gap-1">
        <FileText className="h-3 w-3" />
        {p.status?.replace("PROPOSAL_STATUS_", "").replace(/_/g, " ")}
      </Badge>
    );
  };

  const displayedVoters = showAllVoters ? votes : votes.slice(0, 10);

  return (
    <div className="space-y-6">
      <VoteDialog
        open={voteOpen}
        onOpenChange={setVoteOpen}
        proposalId={String(p.id || p.proposal_id)}
        proposalTitle={p.title}
      />
      <DepositDialog
        open={depositOpen}
        onOpenChange={setDepositOpen}
        proposalId={String(p.id || p.proposal_id)}
        proposalTitle={p.title}
        minDepositUjay={minDepositUjay}
        currentDepositUjay={String(currentDeposit)}
      />

      {/* Back link */}
      <Link
        to="/proposals"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition"
      >
        ← Back to proposals
      </Link>

      {/* Hero Card */}
      <Card className="card-3d p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/10 to-transparent rounded-bl-3xl -mr-4 -mt-4" />
        <div className="relative">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm text-muted-foreground font-mono">
                  Proposal #{p.id || p.proposal_id}
                </span>
                {statusBadge()}
              </div>
              <h1 className="text-2xl font-bold leading-tight">{p.title}</h1>
            </div>
            <div className="flex gap-2 shrink-0">
              {inDeposit && (
                <button
                  onClick={openDeposit}
                  className="btn-3d border border-primary/40 text-primary rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary/10 transition"
                >
                  <Coins className="h-4 w-4 inline mr-1.5" />
                  Deposit
                </button>
              )}
              {inVoting && (
                <button
                  onClick={openVote}
                  className="btn-3d bg-gradient-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium shadow-glow hover:opacity-90 transition"
                >
                  <CheckCircle className="h-4 w-4 inline mr-1.5" />
                  Vote Now
                </button>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-line leading-relaxed">
            {p.summary}
          </div>

          {/* Messages toggle */}
          {p.messages && p.messages.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <button
                onClick={() => setShowMessages(!showMessages)}
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                <FileText className="h-4 w-4" />
                {p.messages.length} Message{p.messages.length > 1 ? "s" : ""}
                {showMessages ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
              {showMessages && (
                <div className="mt-3 space-y-2">
                  {p.messages.map((msg: any, idx: number) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-border bg-muted/30 p-3 text-xs"
                    >
                      <div className="font-mono text-primary font-medium mb-1.5">
                        {msg["@type"]?.split(".").pop()}
                      </div>
                      <pre className="whitespace-pre-wrap text-muted-foreground text-[11px] overflow-auto max-h-40">
                        {JSON.stringify(
                          (() => {
                            const { "@type": _, ...rest } = msg;
                            return rest;
                          })(),
                          null,
                          2,
                        )}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Deposit Progress */}
      {inDeposit && (
        <Card className="card-3d p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2">
              <Coins className="h-4 w-4 text-warning" />
              Deposit Progress
            </h2>
            <span className="text-xs text-muted-foreground">
              {depositPct >= 1 ? "✅ Minimum reached" : "⏳ Waiting for deposits"}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-mono">{formatAmount(currentDeposit)} JAY</span>
            <span className="text-muted-foreground">
              of {formatAmount(minDepositUjay)} JAY minimum
            </span>
          </div>
          <div className="h-3 bg-muted/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-warning to-primary transition-all duration-700"
              style={{ width: `${depositPct * 100}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            {pct(depositPct)} of minimum reached
          </div>
        </Card>
      )}

      {/* Tally */}
      <Card className="card-3d p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold flex items-center gap-2">
            <BarChartIcon className="h-4 w-4 text-primary" />
            Vote Tally
          </h2>
          <span className="text-xs text-muted-foreground">
            Total: {formatAmount(total)} JAY
          </span>
        </div>

        {/* Tally bars */}
        <div className="space-y-4">
          {[
            { k: yes, label: "Yes", color: "bg-success" },
            { k: no, label: "No", color: "bg-destructive" },
            { k: veto, label: "No With Veto", color: "bg-warning" },
            { k: abstain, label: "Abstain", color: "bg-muted-foreground" },
          ].map((o) => {
            const ratio = total ? o.k / total : 0;
            return (
              <div key={o.label}>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="font-medium">{o.label}</span>
                  <span className="font-mono text-muted-foreground text-xs">
                    {formatAmount(o.k)} JAY · {pct(ratio)}
                  </span>
                </div>
                <div className="h-3 bg-muted/40 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${o.color} rounded-full transition-all duration-500`}
                    style={{ width: `${ratio * 100}%` }}
                  />
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
              description="% of total bonded tokens voted"
            />
            <ThresholdMeter
              label="Pass Threshold"
              current={yesPct}
              required={thresholdRatio}
              description="% of yes among yes+no+veto"
            />
            <ThresholdMeter
              label="Veto Threshold"
              current={vetoPct}
              required={vetoRatio}
              invert
              description="% of veto among total votes"
            />
          </div>
        )}
      </Card>

      {/* Timeline */}
      <Card className="card-3d p-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Timeline
        </h2>
        <div className="space-y-2 text-sm">
          <Row label="Submitted" value={fmtDate(p.submit_time)} />
          <Row label="Deposit End" value={fmtDate(p.deposit_end_time)} />
          <Row label="Voting Start" value={fmtDate(p.voting_start_time)} />
          <Row
            label="Voting End"
            value={
              <span>
                {fmtDate(p.voting_end_time)}{" "}
                {inVoting && (
                  <span className="text-warning text-xs">(in {timeAgo(p.voting_end_time)})</span>
                )}
              </span>
            }
          />
          <Row label="Total Deposit" value={`${formatAmount(currentDeposit)} JAY`} />
          <Row
            label="Proposer"
            value={
              <Link
                to="/accounts/$address"
                params={{ address: p.proposer }}
                className="text-primary hover:underline font-mono text-xs"
              >
                {shorten(p.proposer, 14, 8)}
              </Link>
            }
          />
        </div>
      </Card>

      {/* Voters */}
      <Card className="card-3d overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Voters ({votes.length})
          </h2>
          <span className="text-xs text-muted-foreground">Auto-refresh 15s</span>
        </div>
        {votes.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            No votes yet. Be the first to vote!
          </div>
        ) : (
          <>
            <div className="divide-y divide-border">
              {displayedVoters.map((v: any, i: number) => {
                const opt =
                  v.option && v.option !== "VOTE_OPTION_UNSPECIFIED"
                    ? VOTE_LABELS[v.option]
                    : v.options?.[0]?.option
                      ? VOTE_LABELS[v.options[0].option]
                      : null;
                const OptIcon = opt?.icon;
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between px-5 py-3 hover:bg-accent/20 transition"
                  >
                    <Link
                      to="/accounts/$address"
                      params={{ address: v.voter }}
                      className="font-mono text-xs text-primary hover:underline"
                    >
                      {shorten(v.voter, 14, 8)}
                    </Link>
                    <div className="flex items-center gap-2">
                      {opt ? (
                        <span className={`inline-flex items-center gap-1.5 text-xs ${opt.color}`}>
                          {OptIcon && <OptIcon className="h-3.5 w-3.5" />}
                          {opt.label}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {votes.length > 10 && (
              <div className="px-5 py-3 border-t border-border text-center">
                <button
                  onClick={() => setShowAllVoters(!showAllVoters)}
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                >
                  {showAllVoters ? (
                    <>
                      <ChevronUp className="h-4 w-4" /> Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" /> Show all {votes.length} voters
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Depositors */}
      {deposits.length > 0 && (
        <Card className="card-3d overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold flex items-center gap-2">
              <Coins className="h-4 w-4 text-primary" />
              Depositors ({deposits.length})
            </h2>
          </div>
          <div className="divide-y divide-border">
            {deposits.map((d: any, i: number) => (
              <div
                key={i}
                className="flex items-center justify-between px-5 py-3 hover:bg-accent/20 transition"
              >
                <Link
                  to="/accounts/$address"
                  params={{ address: d.depositor }}
                  className="font-mono text-xs text-primary hover:underline"
                >
                  {shorten(d.depositor, 14, 8)}
                </Link>
                <span className="font-mono text-xs">
                  {formatAmount(d.amount?.[0]?.amount ?? 0)} JAY
                </span>
              </div>
            ))}
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
  description,
}: {
  label: string;
  current: number;
  required: number;
  invert?: boolean;
  description?: string;
}) {
  const pass = invert ? current < required : current >= required;
  return (
    <div className="rounded-xl border border-border bg-muted/10 p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        <Badge variant={pass ? "success" : "muted"} className="text-[10px]">
          {pass ? "MET" : "PENDING"}
        </Badge>
      </div>
      <div className="text-lg font-mono font-bold">
        {pct(current)}{" "}
        <span className="text-muted-foreground text-sm font-normal">/ {pct(required)}</span>
      </div>
      {description && (
        <div className="text-[10px] text-muted-foreground mt-1">{description}</div>
      )}
      <div className="mt-3 h-2 bg-muted/40 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            pass ? "bg-success" : "bg-primary"
          }`}
          style={{
            width: `${Math.min((current / Math.max(required, 0.0001)) * 100, 100)}%`,
          }}
        />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

function BarChartIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}
