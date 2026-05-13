import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lcd, safe } from "@/lib/cosmos";
import { Card, Skeleton } from "@/components/shared/ui";

export const Route = createFileRoute("/parameters")({
  head: () => ({
    meta: [{ title: "Network Parameters · Jay Network Explorer" }],
  }),
  component: ParametersPage,
});

function Section({ title, data }: { title: string; data: any }) {
  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-muted/20">
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      {!data ? (
        <div className="px-5 py-6">
          <Skeleton className="h-20 w-full" />
        </div>
      ) : (
        <div className="divide-y divide-border">
          {Object.entries(data).map(([k, v]) => (
            <div
              key={k}
              className="grid grid-cols-1 sm:grid-cols-[260px_1fr] gap-1 sm:gap-4 px-5 py-2.5 text-sm"
            >
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                {k.replace(/_/g, " ")}
              </div>
              <div className="font-mono text-xs break-all">
                {typeof v === "object" ? JSON.stringify(v) : String(v)}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function ParametersPage() {
  const staking = useQuery({ queryKey: ["p-staking"], queryFn: () => safe(lcd.stakingParams()) });
  const slashing = useQuery({
    queryKey: ["p-slashing"],
    queryFn: () => safe(lcd.slashingParams()),
  });
  const dist = useQuery({ queryKey: ["p-dist"], queryFn: () => safe(lcd.distributionParams()) });
  const mint = useQuery({ queryKey: ["p-mint"], queryFn: () => safe(lcd.mintParams()) });
  const govVote = useQuery({
    queryKey: ["p-gov-v"],
    queryFn: () => safe(lcd.govParams("voting")),
  });
  const govTally = useQuery({
    queryKey: ["p-gov-t"],
    queryFn: () => safe(lcd.govParams("tallying")),
  });
  const govDep = useQuery({
    queryKey: ["p-gov-d"],
    queryFn: () => safe(lcd.govParams("deposit")),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Network Parameters</h1>
        <p className="text-sm text-muted-foreground">On-chain module parameters</p>
      </div>
      <div className="grid gap-4">
        <Section title="Staking" data={staking.data?.params} />
        <Section title="Slashing" data={slashing.data?.params} />
        <Section title="Distribution" data={dist.data?.params} />
        <Section title="Mint" data={mint.data?.params} />
        <Section
          title="Governance"
          data={
            govVote.data || govTally.data || govDep.data
              ? {
                  ...(govVote.data?.voting_params ?? {}),
                  ...(govTally.data?.tally_params ?? {}),
                  ...(govDep.data?.deposit_params ?? {}),
                }
              : null
          }
        />
      </div>
    </div>
  );
}
