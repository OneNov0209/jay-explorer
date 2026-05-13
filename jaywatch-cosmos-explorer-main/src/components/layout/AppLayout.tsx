import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Boxes,
  Shield,
  ArrowRightLeft,
  Vote,
  SlidersHorizontal,
  Wallet,
  Search,
  ExternalLink,
  Copy,
  LogOut,
  BarChart3,
  Globe,
  Coins,
  Menu,
  User,
  Activity,
  Send,
  Gift,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { defaultNetwork } from "@/data/networks";
import { useWallet } from "@/lib/wallet";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { rpc, lcd, safe } from "@/lib/cosmos";
import { shorten, formatAmount } from "@/lib/format";
import { toast } from "sonner";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { TransactionModal } from "@/components/tx/TransactionModal";
import { ClaimDialog } from "@/components/tx/VoteClaimDialogs";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

const ONENOV_LOGO =
  "https://raw.githubusercontent.com/OneNov0209/logo/refs/heads/main/logo-OneNov.png";

const NAV: Array<{ to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean; requireAddress?: boolean }> = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/accounts", label: "Account", icon: User, requireAddress: true },
  { to: "/validators", label: "Validators", icon: Shield },
  { to: "/blocks", label: "Blocks", icon: Boxes },
  { to: "/transactions", label: "Txs", icon: ArrowRightLeft },
  { to: "/consensus", label: "Consensus", icon: Zap },
  { to: "/uptime", label: "Uptime", icon: Activity },
  { to: "/ibc-transfer", label: "IBC Transfer", icon: Globe },
  { to: "/proposals", label: "Proposals", icon: Vote },
  { to: "/cosmwasm", label: "CosmWasm", icon: Coins },
  { to: "/parameters", label: "Parameters", icon: SlidersHorizontal },
  { to: "/globe", label: "Network Globe", icon: Globe },
  { to: "/state-sync", label: "State Sync", icon: RefreshCw },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { address, name, connect, disconnect, connecting } = useWallet();
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sidebar-hidden") === "1";
  });
  useEffect(() => {
    if (typeof window !== "undefined")
      localStorage.setItem("sidebar-hidden", sidebarHidden ? "1" : "0");
  }, [sidebarHidden]);
  const navigate = useNavigate();

  const { data: status } = useQuery({
    queryKey: ["rpc-status"],
    queryFn: () => rpc.status(),
    refetchInterval: defaultNetwork.blockTime * 1000,
    placeholderData: keepPreviousData,
  });
  const height = status?.result?.sync_info?.latest_block_height as string | undefined;
  const synced = status && !status?.result?.sync_info?.catching_up;

  const { data: walletBal } = useQuery({
    queryKey: ["wallet-bal-header", address],
    queryFn: () => safe(lcd.balance(address!)),
    enabled: !!address,
    refetchInterval: 10_000,
    placeholderData: keepPreviousData,
  });
  const walletAmount =
    (walletBal as any)?.balances?.find((b: any) => b.denom === defaultNetwork.denom)?.amount ?? "0";

  const { data: walletRewards } = useQuery({
    queryKey: ["wallet-rewards-header", address],
    queryFn: () => safe(lcd.rewards(address!)),
    enabled: !!address,
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
  });
  const rewardValidators: string[] = ((walletRewards as any)?.rewards ?? [])
    .filter((r: any) =>
      (r.reward ?? []).some(
        (c: any) => c.denom === defaultNetwork.denom && Number(c.amount) > 0,
      ),
    )
    .map((r: any) => r.validator_address);
  const totalRewardsUjay = Math.floor(
    Number(
      (walletRewards as any)?.total?.find((t: any) => t.denom === defaultNetwork.denom)
        ?.amount ?? 0,
    ),
  );

  const isLanding = path === "/";

  if (isLanding) {
    return (
      <>
        <LandingIntro />
        <div className="min-h-screen flex flex-col">
          <LandingNav
            address={address}
            name={name}
            connect={connect}
            connecting={connecting}
            disconnect={disconnect}
          />
          <main className="flex-1 px-4 md:px-8 py-6">{children}</main>
          <LandingFooter />
        </div>
      </>
    );
  }

  const isActive = (to: string, exact?: boolean) =>
    exact ? path === to : path === to || path.startsWith(to + "/");

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    if (/^#?\d+$/.test(q) && q.startsWith("#"))
      navigate({ to: "/proposals/$id", params: { id: q.slice(1) } });
    else if (/^\d+$/.test(q)) navigate({ to: "/blocks/$height", params: { height: q } });
    else if (/^[A-Fa-f0-9]{64}$/.test(q))
      navigate({ to: "/transactions/$hash", params: { hash: q.toUpperCase() } });
    else if (q.startsWith(defaultNetwork.bech32Config.bech32PrefixValAddr))
      navigate({ to: "/validators/$address", params: { address: q } });
    else if (q.startsWith(defaultNetwork.prefix))
      navigate({ to: "/accounts/$address", params: { address: q } });
    else toast.error("Unrecognized query");
    setSearch("");
  };

  const copyAddr = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    toast.success("Address copied");
  };

  const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      <div className="flex items-center justify-end px-3 pt-3 pb-1">
        <button
          onClick={() => {
            setSidebarHidden(true);
            onNavigate?.();
          }}
          className="hidden md:inline-flex items-center gap-1.5 h-7 px-2 rounded-md border border-sidebar-border bg-sidebar-accent/40 hover:bg-sidebar-accent text-[11px] text-sidebar-foreground transition"
          title="Hide sidebar"
        >
          <PanelLeftClose className="h-3.5 w-3.5" />
          Hide
        </button>
      </div>
      <div className="px-5 pt-2 pb-5 border-b border-sidebar-border">
        <a
          href="https://onenov.xyz"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 group"
        >
          <img
            src={ONENOV_LOGO}
            alt="OneNov"
            className="h-9 w-9 rounded-lg ring-1 ring-primary/30"
          />
          <div className="leading-tight">
            <div className="text-sm font-semibold text-sidebar-foreground group-hover:text-primary transition">
              OneNov
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Infrastructure
            </div>
          </div>
          <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
        </a>
      </div>

      <div className="px-5 py-4 border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-3 group" title="Back to landing page">
          <img
            src={defaultNetwork.logo}
            alt={defaultNetwork.displayName}
            className="h-10 w-10 rounded-full ring-2 ring-primary/40 group-hover:ring-primary transition"
          />
          <div className="leading-tight">
            <div className="text-sm font-semibold text-sidebar-foreground group-hover:text-primary transition">
              {defaultNetwork.displayName}
            </div>
            <div className="text-[10px] text-muted-foreground font-mono">
              {defaultNetwork.chainId}
            </div>
          </div>
        </Link>
        <LiveSyncCard
          synced={!!synced}
          height={height}
          blockTimeIso={status?.result?.sync_info?.latest_block_time}
          catchingUp={!!status?.result?.sync_info?.catching_up}
        />
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map((item) => {
          const Icon = item.icon;
          const isAccount = item.to === "/accounts";
          const active = isActive(item.to, item.exact);
          const linkProps =
            isAccount && address
              ? ({ to: "/accounts/$address", params: { address } } as const)
              : ({ to: item.to as any } as const);
          return (
            <Link
              key={item.to}
              {...(linkProps as any)}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                active
                  ? "bg-sidebar-accent text-sidebar-foreground shadow-sm"
                  : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/40"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border space-y-2">
        <a
          href="https://onenov.xyz"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground hover:text-primary transition"
        >
          Built by <span className="font-semibold text-primary">OneNov</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen w-full">
      {/* Desktop Sidebar */}
      {!sidebarHidden && (
        <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar/80 backdrop-blur sticky top-0 h-screen">
          <SidebarContent />
        </aside>
      )}

      {/* Mobile Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="p-0 w-72 bg-sidebar border-sidebar-border flex flex-col">
          <SidebarContent onNavigate={() => setDrawerOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-border">
          <div className="flex items-center gap-3 px-4 md:px-8 h-16">
            <button
              onClick={() => setDrawerOpen(true)}
              className="md:hidden h-9 w-9 grid place-items-center rounded-lg border border-border hover:bg-accent/40"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            {sidebarHidden && (
              <button
                onClick={() => setSidebarHidden(false)}
                className="hidden md:grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-accent/40"
                aria-label="Show sidebar"
                title="Show sidebar"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            )}
            <Link to="/" className="md:hidden flex items-center gap-2">
              <img src={defaultNetwork.logo} className="h-8 w-8 rounded-full" alt="" />
              <span className="font-semibold hidden sm:inline">Jay Explorer</span>
            </Link>
            <form onSubmit={onSearch} className="flex-1 max-w-xl">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search height / tx / address / #proposal"
                  className="w-full pl-10 pr-4 h-10 rounded-lg bg-card border border-border focus:border-primary focus:outline-none text-sm placeholder:text-muted-foreground/60 transition"
                />
              </div>
            </form>
            <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse-dot" />
              #{height ? Number(height).toLocaleString() : "—"}
            </div>

            <ThemeToggle />

            {/* Connect Keplr — top right */}
            {address ? (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-card pl-2 pr-1 py-1">
                <img
                  src="https://raw.githubusercontent.com/OneNov0209/logo/refs/heads/main/keplr.png"
                  alt="Keplr"
                  className="h-5 w-5 rounded"
                />
                <div className="leading-tight hidden sm:block">
                  <div className="text-[11px] font-medium truncate max-w-[140px]">{name}</div>
                  <div className="text-[10px] font-mono text-muted-foreground">
                    {shorten(address, 6, 4)}
                  </div>
                </div>
                <div className="hidden md:flex flex-col items-end px-2 border-l border-border ml-1">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Balance</div>
                  <div className="text-[11px] font-mono font-semibold text-primary">
                    {formatAmount(walletAmount, { precision: 4 })}
                  </div>
                </div>
                <button
                  onClick={() => setSendOpen(true)}
                  className="h-7 w-7 grid place-items-center rounded hover:bg-primary/20 text-primary"
                  title="Send"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setClaimOpen(true)}
                  disabled={totalRewardsUjay === 0}
                  className="h-7 w-7 grid place-items-center rounded hover:bg-success/20 text-success disabled:opacity-40"
                  title={
                    totalRewardsUjay === 0
                      ? "No rewards"
                      : `Claim ${formatAmount(totalRewardsUjay, { precision: 4 })}`
                  }
                >
                  <Gift className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={copyAddr}
                  className="h-7 w-7 grid place-items-center rounded hover:bg-accent/40"
                  title="Copy"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={disconnect}
                  className="h-7 w-7 grid place-items-center rounded hover:bg-destructive/30"
                  title="Disconnect"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={connect}
                disabled={connecting}
                className="bg-gradient-primary text-primary-foreground rounded-lg h-10 px-3 sm:px-4 text-sm font-medium flex items-center gap-2 hover:opacity-90 transition shadow-glow disabled:opacity-60"
              >
                <Wallet className="h-4 w-4" />
                <span className="hidden sm:inline">{connecting ? "Connecting…" : "Connect Keplr"}</span>
              </button>
            )}
          </div>
        </header>
        <main className="flex-1 px-4 md:px-8 py-6">{children}</main>
        <footer className="border-t border-border bg-sidebar/40 mt-8">
          <div className="px-4 md:px-8 py-8 grid gap-8 md:grid-cols-4">
            <div className="md:col-span-2 space-y-3">
              <div className="flex items-center gap-3">
                <img
                  src={defaultNetwork.logo}
                  alt={defaultNetwork.displayName}
                  className="h-9 w-9 rounded-full ring-2 ring-primary/40"
                />
                <div>
                  <div className="font-semibold text-foreground">
                    {defaultNetwork.displayName}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono">
                    {defaultNetwork.chainId}
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground max-w-md leading-relaxed">
                A Cosmos SDK powered chain with CosmWasm smart contracts and IBC
                interoperability — explore blocks, validators, governance and supply.
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <div className="font-semibold text-foreground uppercase tracking-wider text-[11px]">
                Ecosystem
              </div>
              <FooterLink href="https://thejaynetwork.com/">Website</FooterLink>
              <FooterLink href="https://github.com/bbtccore/thejaynetwork">GitHub</FooterLink>
              <FooterLink href="https://pixture.thejaynetwork.com/">Pixture</FooterLink>
              <FooterLink href="https://games.thejaynetwork.com/">Games</FooterLink>
            </div>

            <div className="space-y-2 text-xs">
              <div className="font-semibold text-foreground uppercase tracking-wider text-[11px]">
                Infrastructure
              </div>
              <FooterLink href={defaultNetwork.rpcs[0]}>RPC Endpoint</FooterLink>
              <FooterLink href={defaultNetwork.apis[0]}>REST API</FooterLink>
              <FooterLink href="https://onenov.xyz">Built by OneNov</FooterLink>
            </div>
          </div>
          <div className="px-4 md:px-8 py-4 border-t border-border text-[11px] text-muted-foreground flex flex-wrap items-center justify-between gap-2">
            <div>© {new Date().getFullYear()} {defaultNetwork.displayName}. All rights reserved.</div>
            <a
              href="https://onenov.xyz"
              target="_blank"
              rel="noreferrer"
              className="hover:text-primary transition inline-flex items-center gap-1"
            >
              Built with care by OneNov <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </footer>
      </div>

      {address && (
        <>
          <TransactionModal open={sendOpen} onOpenChange={setSendOpen} mode="send" />
          <ClaimDialog
            open={claimOpen}
            onOpenChange={setClaimOpen}
            validatorAddrs={rewardValidators}
            totalRewardsUjay={totalRewardsUjay}
          />
        </>
      )}
    </div>
  );
}

function LandingIntro() {
  const [phase, setPhase] = useState<"show" | "fading" | "done">("show");
  useEffect(() => {
    const t1 = setTimeout(() => setPhase("fading"), 1600);
    const t2 = setTimeout(() => setPhase("done"), 2400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (phase === "done") return null;

  return (
    <div
      className={`fixed inset-0 z-[100] grid place-items-center bg-background overflow-hidden pointer-events-none transition-all duration-[800ms] ease-out ${
        phase === "fading" ? "opacity-0 scale-105" : "opacity-100 scale-100"
      }`}
      aria-hidden
    >
      <style>{`
        @keyframes introRing { 0%{transform:scale(0);opacity:0.8} 100%{transform:scale(3);opacity:0} }
        @keyframes introLogo { 0%{transform:scale(0.4) rotate(-180deg);opacity:0} 60%{transform:scale(1.1) rotate(10deg);opacity:1} 100%{transform:scale(1) rotate(0);opacity:1} }
        @keyframes introText { 0%{opacity:0;letter-spacing:0.5em} 100%{opacity:1;letter-spacing:0.05em} }
        @keyframes introBar { 0%{width:0%} 100%{width:100%} }
        @keyframes introOrb { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(20px,-20px) scale(1.2)} }
      `}</style>
      <div className="absolute inset-0 bg-gradient-glow" />
      <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/30 blur-3xl animate-[introOrb_4s_ease-in-out_infinite]" />
      <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl animate-[introOrb_5s_ease-in-out_infinite_reverse]" />

      <div className="relative flex flex-col items-center gap-6">
        <div className="relative h-32 w-32">
          <span className="absolute inset-0 rounded-full border-2 border-primary animate-[introRing_2s_ease-out_infinite]" />
          <span className="absolute inset-0 rounded-full border-2 border-primary animate-[introRing_2s_ease-out_0.6s_infinite]" />
          <img
            src={defaultNetwork.logo}
            alt=""
            className="relative h-32 w-32 rounded-full ring-4 ring-primary/40 shadow-glow animate-[introLogo_1s_cubic-bezier(0.2,0.9,0.3,1.4)_forwards]"
          />
        </div>
        <div className="text-3xl md:text-5xl font-bold bg-gradient-to-br from-foreground to-primary bg-clip-text text-transparent opacity-0 animate-[introText_1s_ease-out_0.4s_forwards]">
          {defaultNetwork.displayName}
        </div>
        <div className="text-xs uppercase tracking-[0.4em] text-muted-foreground opacity-0 animate-[introText_1s_ease-out_0.7s_forwards]">
          Cosmos Explorer
        </div>
        <div className="relative h-0.5 w-64 bg-border overflow-hidden rounded-full mt-4">
          <div className="absolute inset-y-0 left-0 bg-gradient-primary animate-[introBar_1.6s_ease-out_forwards]" />
        </div>
      </div>
    </div>
  );
}

function LiveSyncCard({
  synced,
  height,
  blockTimeIso,
  catchingUp,
}: {
  synced: boolean;
  height?: string;
  blockTimeIso?: string;
  catchingUp: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const blockTs = blockTimeIso ? new Date(blockTimeIso).getTime() : 0;
  const ageSec = blockTs ? Math.max(0, Math.floor((now - blockTs) / 1000)) : null;
  const stale = ageSec !== null && ageSec > Math.max(15, defaultNetwork.blockTime * 5);
  const status = catchingUp
    ? { label: "Catching up", color: "bg-warning", text: "text-warning" }
    : !synced
      ? { label: "Connecting", color: "bg-destructive", text: "text-destructive" }
      : stale
        ? { label: "Stalled", color: "bg-warning", text: "text-warning" }
        : { label: "Live", color: "bg-success", text: "text-success" };

  return (
    <div className="mt-3 rounded-lg border border-sidebar-border/60 bg-sidebar-accent/40 px-2.5 py-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className={`absolute inline-flex h-full w-full rounded-full ${status.color} opacity-60 animate-ping`} />
            <span className={`relative inline-flex h-2 w-2 rounded-full ${status.color}`} />
          </span>
          <span className={`text-[11px] font-semibold uppercase tracking-wider ${status.text}`}>
            {status.label}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">
          {ageSec !== null ? `${ageSec}s ago` : "—"}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Height</span>
        <span className="text-[11px] font-mono font-semibold text-sidebar-foreground tabular-nums">
          #{height ? Number(height).toLocaleString() : "—"}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Block</span>
        <span className="text-[10px] font-mono text-muted-foreground">
          ~{defaultNetwork.blockTime}s
        </span>
      </div>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="block text-muted-foreground hover:text-primary transition"
    >
      {children}
    </a>
  );
}

export const landingScroll = (id: string) => (e: React.MouseEvent) => {
  e.preventDefault();
  if (typeof window === "undefined") return;
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
};

function LandingNav({
  address,
  name,
  connect,
  connecting,
  disconnect,
}: {
  address: string | null;
  name: string | null;
  connect: () => void;
  connecting: boolean;
  disconnect: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/60 border-b border-border/60">
      <div className="px-4 md:px-8 h-16 flex items-center gap-4">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative">
            <span className="absolute inset-0 rounded-full bg-primary/40 blur-md group-hover:bg-primary/60 transition" />
            <img src={defaultNetwork.logo} alt="" className="relative h-9 w-9 rounded-full ring-2 ring-primary/40" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold">{defaultNetwork.displayName}</div>
            <div className="text-[10px] font-mono text-muted-foreground">{defaultNetwork.chainId}</div>
          </div>
        </Link>
        <nav className="hidden md:flex items-center gap-1 ml-6 text-sm">
          <a href="#stats" onClick={landingScroll("stats")} className="px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/40 transition cursor-pointer">Stats</a>
          <a href="#explore" onClick={landingScroll("explore")} className="px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/40 transition cursor-pointer">Explore</a>
          <a href="#ecosystem" onClick={landingScroll("ecosystem")} className="px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/40 transition cursor-pointer">Ecosystem</a>
          <Link to="/dashboard" className="px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/40 transition">Dashboard</Link>
        </nav>
        <div className="flex-1" />
        <ThemeToggle />
        <Link
          to="/dashboard"
          className="hidden sm:inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-gradient-primary text-primary-foreground text-sm font-semibold shadow-glow hover:opacity-90 transition"
        >
          Get Explorer
        </Link>
        {address ? (
          <button
            onClick={disconnect}
            className="inline-flex items-center gap-2 h-10 px-3 rounded-lg border border-border bg-card hover:bg-accent/40 text-sm"
            title={name ?? ""}
          >
            <Wallet className="h-4 w-4 text-primary" />
            <span className="font-mono text-xs">{shorten(address, 5, 4)}</span>
          </button>
        ) : (
          <button
            onClick={connect}
            disabled={connecting}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-primary/40 text-primary hover:bg-primary/10 text-sm font-medium disabled:opacity-60"
          >
            <Wallet className="h-4 w-4" />
            <span className="hidden sm:inline">{connecting ? "Connecting…" : "Connect"}</span>
          </button>
        )}
      </div>
    </header>
  );
}

function LandingFooter() {
  return (
    <footer className="relative border-t border-border bg-sidebar/40 mt-12 overflow-hidden">
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-[60%] bg-primary/10 blur-3xl rounded-full pointer-events-none" />
      <div className="relative px-4 md:px-8 py-12 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center gap-3">
            <img src={defaultNetwork.logo} alt="" className="h-10 w-10 rounded-full ring-2 ring-primary/40" />
            <div>
              <div className="font-bold text-foreground">{defaultNetwork.displayName}</div>
              <div className="text-[11px] text-muted-foreground font-mono">{defaultNetwork.chainId}</div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground max-w-md leading-relaxed">
            A Cosmos SDK powered chain with CosmWasm smart contracts and IBC interoperability —
            explore blocks, validators, governance and supply with a beautiful, real-time interface.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-md border border-border bg-card/60 text-muted-foreground">Cosmos SDK</span>
            <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-md border border-border bg-card/60 text-muted-foreground">CosmWasm</span>
            <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-md border border-border bg-card/60 text-muted-foreground">IBC</span>
          </div>
        </div>

        <div className="space-y-2 text-xs">
          <div className="font-semibold text-foreground uppercase tracking-wider text-[11px]">Explore</div>
          <Link to="/dashboard" className="block text-muted-foreground hover:text-primary transition">Dashboard</Link>
          <Link to="/validators" className="block text-muted-foreground hover:text-primary transition">Validators</Link>
          <Link to="/blocks" className="block text-muted-foreground hover:text-primary transition">Blocks</Link>
          <Link to="/proposals" className="block text-muted-foreground hover:text-primary transition">Proposals</Link>
          <Link to="/ibc-transfer" className="block text-muted-foreground hover:text-primary transition">IBC Transfer</Link>
        </div>

        <div className="space-y-2 text-xs">
          <div className="font-semibold text-foreground uppercase tracking-wider text-[11px]">Ecosystem</div>
          <FooterLink href="https://thejaynetwork.com/">Website</FooterLink>
          <FooterLink href="https://github.com/bbtccore/thejaynetwork">GitHub</FooterLink>
          <FooterLink href="https://pixture.thejaynetwork.com/">Pixture</FooterLink>
          <FooterLink href="https://games.thejaynetwork.com/">Games</FooterLink>
          <FooterLink href="https://onenov.xyz">Built by OneNov</FooterLink>
        </div>
      </div>
      <div className="relative px-4 md:px-8 py-4 border-t border-border text-[11px] text-muted-foreground flex flex-wrap items-center justify-between gap-2">
        <div>© {new Date().getFullYear()} {defaultNetwork.displayName}. All rights reserved.</div>
        <a href="https://onenov.xyz" target="_blank" rel="noreferrer" className="hover:text-primary transition inline-flex items-center gap-1">
          Built with care by OneNov <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </footer>
  );
}

