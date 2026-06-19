// src/routes/tokens.tsx
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Card, Badge, Skeleton } from "@/components/shared/ui";
import { defaultNetwork } from "@/data/networks";
import { formatAmount, shorten } from "@/lib/format";
import { Search, Coins, Star, ExternalLink, ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/tokens")({
  head: () => ({
    meta: [
      { title: "Tokens · Jay Network Explorer" },
      { name: "description", content: "All tokens on Jay Network." },
    ],
  }),
  component: TokensRouteComponent,
});

function TokensRouteComponent() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return path === "/tokens" ? <TokensPage /> : <Outlet />;
}

function TokensPage() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "native" | "factory">("all");

  // Fetch token metadata
  const { data: metadata, isLoading } = useQuery({
    queryKey: ["token-metadata"],
    queryFn: async () => {
      const api = defaultNetwork.apis[0];
      const res = await fetch(`${api}/cosmos/bank/v1beta1/denoms_metadata`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      return (data.metadatas ?? []) as any[];
    },
    refetchInterval: 30_000,
  });

  // Fetch supply
  const { data: supply } = useQuery({
    queryKey: ["token-supply"],
    queryFn: async () => {
      const api = defaultNetwork.apis[0];
      const res = await fetch(`${api}/cosmos/bank/v1beta1/supply`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      return (data.supply ?? []) as any[];
    },
    refetchInterval: 30_000,
  });

  const tokens = useMemo(() => {
    if (!metadata) return [];

    const supplyMap = new Map<string, string>();
    for (const s of supply ?? []) {
      supplyMap.set(s.denom, s.amount);
    }

    return metadata
      .map((m: any) => {
        const displayName =
          m.display ||
          m.name ||
          (m.symbol ? m.symbol.toUpperCase() : m.denom?.slice(0, 10) + "...");
        const isNative = m.denom === defaultNetwork.denom;
        const isIBC = m.denom?.startsWith("ibc/");
        const isFactory = !isNative && !isIBC && !m.denom?.startsWith("ibc/");
        const totalSupply = supplyMap.get(m.denom) || supplyMap.get(m.base) || "0";
        const decimals = m.denom_units?.find((u: any) => u.denom === m.display)?.exponent ?? 6;

        // Ambil logo dari URI kalau ada
        const logo =
          m.uri?.includes("http") ? m.uri : null;

        return {
          denom: m.denom || m.base,
          base: m.base || m.denom,
          displayName,
          symbol: m.symbol || "",
          description: m.description || "",
          decimals,
          totalSupply,
          isNative,
          isIBC,
          isFactory,
          logo,
          uri: m.uri || "",
        };
      })
      .sort((a, b) => {
        if (a.isNative) return -1;
        if (b.isNative) return 1;
        return a.displayName.localeCompare(b.displayName);
      });
  }, [metadata, supply]);

  const filtered = useMemo(() => {
    let result = tokens;
    if (tab === "native") result = result.filter((t) => t.isNative);
    if (tab === "factory") result = result.filter((t) => t.isFactory);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.displayName.toLowerCase().includes(q) ||
          t.symbol?.toLowerCase().includes(q) ||
          t.denom?.toLowerCase().includes(q),
      );
    }
    return result;
  }, [tokens, tab, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Coins className="h-6 w-6 text-primary" /> Tokens
        </h1>
        <p className="text-sm text-muted-foreground">
          All tokens on {defaultNetwork.displayName} — native, IBC, and factory tokens
        </p>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="flex gap-1 p-1 bg-muted/30 rounded-lg text-xs">
          {([
            { key: "all", label: "All", count: tokens.length },
            { key: "native", label: "Native", count: tokens.filter((t) => t.isNative).length },
            { key: "factory", label: "Factory", count: tokens.filter((t) => t.isFactory).length },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                tab === t.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tokens..."
            className="w-full pl-10 pr-3 h-9 text-sm rounded-lg bg-card border border-border focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      {/* Token Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          No tokens found
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((token) => (
            <Link
              key={token.denom}
              to="/tokens/$denom"
              params={{ denom: token.denom }}
            >
              <Card className="card-3d p-5 hover:border-primary/40 transition cursor-pointer h-full group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {token.logo ? (
                      <img
                        src={token.logo}
                        alt={token.displayName}
                        className="h-10 w-10 rounded-full"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div
                        className={`h-10 w-10 rounded-full grid place-items-center ${
                          token.isNative
                            ? "bg-primary/15 text-primary"
                            : token.isIBC
                              ? "bg-success/15 text-success"
                              : "bg-violet-500/15 text-violet-500"
                        }`}
                      >
                        <Coins className="h-5 w-5" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold group-hover:text-primary transition truncate max-w-[180px]">
                        {token.displayName}
                      </h3>
                      {token.symbol && (
                        <div className="text-[11px] text-muted-foreground">
                          {token.symbol}
                        </div>
                      )}
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition shrink-0" />
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {token.isNative && (
                    <Badge variant="default" className="text-[10px]">
                      <Star className="h-2.5 w-2.5 mr-1" /> Native
                    </Badge>
                  )}
                  {token.isIBC && (
                    <Badge variant="success" className="text-[10px]">
                      IBC
                    </Badge>
                  )}
                  {token.isFactory && (
                    <Badge variant="muted" className="text-[10px]">
                      Token Factory
                    </Badge>
                  )}
                </div>

                {/* Description */}
                {token.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                    {token.description}
                  </p>
                )}

                {/* Supply */}
                <div className="flex items-center justify-between text-xs mt-auto pt-3 border-t border-border">
                  <span className="text-muted-foreground">Total Supply</span>
                  <span className="font-mono font-semibold">
                    {formatAmount(token.totalSupply, { precision: 0 })} {token.symbol || ""}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
