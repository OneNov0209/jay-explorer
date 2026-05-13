import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { defaultNetwork } from "@/data/networks";
import { Badge } from "@/components/shared/ui";
import { rpc, lcd, safe } from "@/lib/cosmos";
import { formatAmount } from "@/lib/format";
import { landingScroll } from "@/components/layout/AppLayout";
import {
  ArrowRight,
  Atom,
  Shield,
  Link2,
  Globe,
  Github,
  Gamepad2,
  Image as ImageIcon,
  ExternalLink,
  Boxes,
  Users,
  PieChart,
  Coins,
  ChevronDown,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Jay Network Explorer · Cosmos SDK Blockchain Explorer" },
      {
        name: "description",
        content:
          "The official block explorer for Jay Network — a Cosmos SDK chain with CosmWasm smart contracts and IBC interoperability.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="space-y-20">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card">
        <div className="absolute inset-0 bg-gradient-glow" />
        <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -left-20 -bottom-20 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative px-6 md:px-12 py-16 md:py-24">
          <div className="flex flex-col items-center text-center max-w-3xl mx-auto">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-full" />
              <img
                src={defaultNetwork.logo}
                alt={defaultNetwork.displayName}
                className="relative h-28 w-28 rounded-3xl ring-2 ring-primary/40 shadow-glow"
              />
            </div>

            <div className="flex items-center gap-2 mb-4">
              <Badge variant="default">{defaultNetwork.type}</Badge>
              <Badge variant="muted">CosmWasm</Badge>
              <Badge variant="muted">IBC Enabled</Badge>
            </div>

            <h1 className="text-4xl md:text-6xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">
              {defaultNetwork.displayName} Explorer
            </h1>
            <p className="mt-4 text-base md:text-lg text-muted-foreground max-w-2xl">
              The official block explorer for{" "}
              <span className="font-mono text-foreground/80">{defaultNetwork.chainId}</span>
              . Explore blocks, validators, governance and cross-chain transfers.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow hover:opacity-90 transition text-base"
              >
                Get Explorer <ArrowRight className="h-5 w-5" />
              </Link>
              <a
                href="#stats"
                onClick={landingScroll("stats")}
                className="inline-flex items-center gap-2 h-12 px-6 rounded-xl border border-primary/40 text-primary hover:bg-primary/10 transition font-semibold"
              >
                View Live Stats <ChevronDown className="h-5 w-5" />
              </a>
              <a
                href="https://thejaynetwork.com/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 h-12 px-6 rounded-xl border border-border bg-card/50 hover:bg-accent/40 transition font-medium"
              >
                Visit Website <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* LIVE STATS */}
      <LiveStats />

      {/* INFRASTRUCTURE */}
      <section className="space-y-6">
        <div className="text-center max-w-2xl mx-auto">
          <Badge variant="muted">Infrastructure</Badge>
          <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">
            Built on battle-tested infrastructure
          </h2>
          <p className="mt-3 text-muted-foreground">
            The Jay Network leverages the most proven blockchain infrastructure in the Cosmos ecosystem.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <FeatureCard icon={<Atom className="h-6 w-6" />} title="Cosmos SDK" version="v0.53.6" description="The latest stable Cosmos SDK with advanced module architecture." />
          <FeatureCard icon={<Shield className="h-6 w-6" />} title="CometBFT" version="v0.38.21" description="Byzantine Fault Tolerant consensus with ~5 second block times." />
          <FeatureCard icon={<Link2 className="h-6 w-6" />} title="IBC" version="v10.4.0" description="Inter-Blockchain Communication for trustless cross-chain transfers." />
        </div>
      </section>

      {/* EXPLORE */}
      <section id="explore" className="space-y-4 scroll-mt-24">
        <div>
          <Badge variant="muted">Explore</Badge>
          <h2 className="mt-2 text-2xl font-bold">Jump into the explorer</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ExploreCard to="/dashboard" icon={<PieChart className="h-5 w-5" />} title="Dashboard" subtitle="Chain overview & charts" />
          <ExploreCard to="/validators" icon={<Shield className="h-5 w-5" />} title="Validators" subtitle="Stake & delegate" />
          <ExploreCard to="/blocks" icon={<Boxes className="h-5 w-5" />} title="Blocks" subtitle="Latest block activity" />
          <ExploreCard to="/proposals" icon={<Users className="h-5 w-5" />} title="Proposals" subtitle="Governance & voting" />
        </div>
      </section>

      {/* ECOSYSTEM */}
      <section id="ecosystem" className="space-y-4 scroll-mt-24">
        <div>
          <Badge variant="muted">Ecosystem</Badge>
          <h2 className="mt-2 text-2xl font-bold">Explore the Jay Network ecosystem</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <EcosystemCard href="https://thejaynetwork.com/" icon={<Globe className="h-5 w-5" />} title="Website" subtitle="thejaynetwork.com" />
          <EcosystemCard href="https://github.com/bbtccore/thejaynetwork" icon={<Github className="h-5 w-5" />} title="GitHub" subtitle="bbtccore/thejaynetwork" />
          <EcosystemCard href="https://pixture.thejaynetwork.com/" icon={<ImageIcon className="h-5 w-5" />} title="Pixture" subtitle="pixture.thejaynetwork.com" />
          <EcosystemCard href="https://games.thejaynetwork.com/" icon={<Gamepad2 className="h-5 w-5" />} title="Games" subtitle="games.thejaynetwork.com" />
        </div>
      </section>
    </div>
  );
}

function LiveStats() {
  const { data: status } = useQuery({
    queryKey: ["landing-rpc-status"],
    queryFn: () => rpc.status(),
    refetchInterval: defaultNetwork.blockTime * 1000,
    placeholderData: keepPreviousData,
  });
  const { data: vals } = useQuery({
    queryKey: ["landing-validators-bonded"],
    queryFn: () => safe(lcd.validatorsAll("BOND_STATUS_BONDED")),
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
  });
  const { data: pool } = useQuery({
    queryKey: ["landing-pool"],
    queryFn: () => safe(lcd.pool()),
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
  });
  const { data: supply } = useQuery({
    queryKey: ["landing-supply"],
    queryFn: () => safe(lcd.supply()),
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });

  const height = status?.result?.sync_info?.latest_block_height as string | undefined;
  const activeValidators = (vals as any)?.validators?.length ?? 0;
  const bonded = Number((pool as any)?.pool?.bonded_tokens ?? 0);
  const notBonded = Number((pool as any)?.pool?.not_bonded_tokens ?? 0);
  const bondedRatio = bonded + notBonded > 0 ? (bonded / (bonded + notBonded)) * 100 : 0;
  const totalSupply = (supply as any)?.supply?.find?.(
    (s: any) => s.denom === defaultNetwork.denom,
  )?.amount;

  return (
    <section id="stats" className="space-y-6 scroll-mt-24">
      <div className="text-center max-w-2xl mx-auto">
        <Badge variant="muted">Live Network</Badge>
        <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">
          Real-time chain statistics
        </h2>
        <p className="mt-3 text-muted-foreground">
          Live data from {defaultNetwork.chainId}, refreshed every few seconds.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Boxes className="h-5 w-5" />}
          label="Block Height"
          value={height ? `#${Number(height).toLocaleString()}` : "—"}
          accent="from-primary/30 to-primary/0"
        />
        <StatCard
          icon={<Shield className="h-5 w-5" />}
          label="Active Validators"
          value={activeValidators ? activeValidators.toLocaleString() : "—"}
          accent="from-emerald-400/30 to-emerald-400/0"
        />
        <StatCard
          icon={<PieChart className="h-5 w-5" />}
          label="Bonded Ratio"
          value={bonded > 0 ? `${bondedRatio.toFixed(2)}%` : "—"}
          accent="from-violet-400/30 to-violet-400/0"
        />
        <StatCard
          icon={<Coins className="h-5 w-5" />}
          label="Total Supply"
          value={totalSupply ? formatAmount(totalSupply, { precision: 0 }) : "—"}
          suffix={defaultNetwork.coinDenom}
          accent="from-amber-400/30 to-amber-400/0"
        />
      </div>

      <div className="flex justify-center">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow hover:opacity-90 transition text-sm"
        >
          Open Full Dashboard <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

function StatCard({
  icon,
  label,
  value,
  suffix,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  suffix?: string;
  accent: string;
}) {
  return (
    <div className="card-3d chart-3d relative overflow-hidden p-5 group">
      <div
        className={`pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-gradient-to-br ${accent} blur-2xl opacity-70 group-hover:opacity-100 transition`}
      />
      <div className="relative flex items-start justify-between">
        <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary grid place-items-center">
          {icon}
        </div>
        <span className="h-2 w-2 rounded-full bg-success animate-pulse-dot mt-1.5" />
      </div>
      <div className="relative mt-4 text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="relative mt-1 flex items-baseline gap-2">
        <div className="text-2xl md:text-3xl font-bold font-mono bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
          {value}
        </div>
        {suffix && (
          <div className="text-xs font-mono text-muted-foreground uppercase">{suffix}</div>
        )}
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, version, description }: { icon: React.ReactNode; title: string; version: string; description: string }) {
  return (
    <div className="card-3d p-6 group relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition" />
      <div className="relative">
        <div className="h-12 w-12 rounded-xl bg-primary/15 text-primary grid place-items-center mb-4 group-hover:scale-110 transition">
          {icon}
        </div>
        <div className="flex items-baseline gap-2 mb-2">
          <h3 className="text-lg font-bold">{title}</h3>
          <span className="text-xs font-mono text-primary">{version}</span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function ExploreCard({ to, icon, title, subtitle }: { to: string; icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <Link to={to as any} className="card-3d group flex items-center gap-3 p-4">
      <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary grid place-items-center group-hover:scale-110 transition">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-[11px] text-muted-foreground truncate">{subtitle}</div>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition" />
    </Link>
  );
}

function EcosystemCard({ href, icon, title, subtitle }: { href: string; icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="card-3d group flex items-center gap-3 p-4">
      <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary grid place-items-center group-hover:scale-110 transition">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-[11px] text-muted-foreground truncate font-mono">{subtitle}</div>
      </div>
      <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition" />
    </a>
  );
}
