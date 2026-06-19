// src/routes/tokens.tsx
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueries } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Card, Badge, Skeleton } from "@/components/shared/ui";
import { defaultNetwork } from "@/data/networks";
import { formatAmount, shorten } from "@/lib/format";
import { Search, Coins, Star, ArrowUpRight, Globe, Code } from "lucide-react";

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
  const [tab, setTab] = useState<"all" | "native" | "factory" | "ibc" | "cw20">("all");

  // ====== FETCH: Supply (native, IBC, token factory) ======
  const { data: allSupply, isLoading: supplyLoading } = useQuery({
    queryKey: ["all-token-supply"],
    queryFn: async () => {
      const api = defaultNetwork.apis[0];
      const res = await fetch(`${api}/cosmos/bank/v1beta1/supply?pagination.limit=2000`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      return (data.supply ?? []) as Array<{ denom: string; amount: string }>;
    },
    refetchInterval: 30_000,
  });

  // ====== FETCH: Metadata ======
  const { data: metadataList } = useQuery({
    queryKey: ["token-metadata"],
    queryFn: async () => {
      const api = defaultNetwork.apis[0];
      const res = await fetch(`${api}/cosmos/bank/v1beta1/denoms_metadata?pagination.limit=500`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.metadatas ?? []) as any[];
    },
    refetchInterval: 30_000,
  });

  // ====== FETCH: IBC Asset Map ======
  const { data: ibcAssetMap } = useQuery({
    queryKey: ["ibc-asset-map"],
    queryFn: async () => {
      const map = new Map<string, { name: string; symbol: string; logo: string; chain: string }>();
      try {
        const res = await fetch(
          `https://raw.githubusercontent.com/cosmos/chain-registry/master/thejaynetwork/assetlist.json`,
        );
        if (!res.ok) return map;
        const data = await res.json();
        for (const asset of data.assets ?? []) {
          if (!asset.denom_units || asset.denom === "ujay") continue;
          const ibcDenom = asset.denom_units.find((u: any) =>
            u.denom.startsWith("ibc/"),
          )?.denom || asset.denom;
          const trace = asset.traces?.[0] || {};
          map.set(ibcDenom, {
            name: asset.name || ibcDenom,
            symbol: asset.symbol || "",
            logo: asset.logo_URIs?.png || asset.image_sync?.png || "",
            chain: trace.counterparty_chain_name || "",
          });
        }
      } catch {}
      return map;
    },
    staleTime: 30 * 60_000,
  });

  // ====== FETCH: CW20 Contracts ======
  const { data: cw20Contracts } = useQuery({
    queryKey: ["cw20-contracts"],
    queryFn: async () => {
      const api = defaultNetwork.apis[0];
      // Ambil semua contract address
      const res = await fetch(
        `${api}/cosmwasm/wasm/v1/contract?pagination.limit=200`,
      );
      if (!res.ok) return [];
      const data = await res.json();
      return (data.contracts ?? []) as string[];
    },
    staleTime: 60_000,
  });

  // ====== FETCH: CW20 Token Info (query tiap contract) ======
  const cw20Queries = useQueries({
    queries: (cw20Contracts ?? []).slice(0, 50).map((contract: string) => ({
      queryKey: ["cw20-token-info", contract],
      queryFn: async () => {
        const api = defaultNetwork.apis[0];
        try {
          const res = await fetch(
            `${api}/cosmwasm/wasm/v1/contract/${contract}/smart/${btoa(JSON.stringify({ token_info: {} }))}`,
          );
          if (!res.ok) return null;
          const data = await res.json();
          if (!data.data) return null;
          const info = JSON.parse(atob(data.data));
          return {
            contract,
            name: info.name || "",
            symbol: info.symbol || "",
            decimals: info.decimals ?? 6,
            totalSupply: info.total_supply || "0",
          };
        } catch {
          return null;
        }
      },
      staleTime: 60_000,
      enabled: !!cw20Contracts,
    })),
  });

  const cw20Tokens = useMemo(() => {
    return cw20Queries
      .filter((q) => q.data)
      .map((q) => q.data!)
      .filter((t) => t.name); // Hanya yang punya nama (token beneran)
  }, [cw20Queries]);

  // ====== MERGE ALL TOKENS ======
  const tokens = useMemo(() => {
    const result: Array<{
      denom: string;
      displayName: string;
      symbol: string;
      description: string;
      decimals: number;
      totalSupply: string;
      isNative: boolean;
      isIBC: boolean;
      isFactory: boolean;
      isCw20: boolean;
      logo: string;
      contract?: string;
    }> = [];

    const metaMap = new Map<string, any>();
    for (const m of metadataList ?? []) {
      metaMap.set(m.denom || m.base, m);
      if (m.base) metaMap.set(m.base, m);
    }

    // Bank tokens (native, IBC, factory)
    for (const s of allSupply ?? []) {
      if (Number(s.amount) <= 0) continue;
      const meta = metaMap.get(s.denom);
      const isNative = s.denom === defaultNetwork.denom;
      const isIBC = s.denom.startsWith("ibc/");
      const isFactory = !isNative && !isIBC;

      let displayName = "";
      let symbol = "";
      let logo = "";
      let description = "";
      let decimals = 6;

      if (meta) {
        displayName = meta.display || meta.name || "";
        symbol = meta.symbol || "";
        description = meta.description || "";
        decimals = meta.denom_units?.find((u: any) => u.denom === meta.display)?.exponent ?? 6;
      }

      if (isIBC && ibcAssetMap?.has(s.denom)) {
        const ibc = ibcAssetMap.get(s.denom)!;
        displayName = displayName || ibc.name;
        symbol = symbol || ibc.symbol;
        logo = logo || ibc.logo;
        if (ibc.chain) description = description || `IBC token from ${ibc.chain}`;
      }

      if (!displayName) {
        if (isNative) {
          displayName = defaultNetwork.coinDenom;
          symbol = defaultNetwork.coinDenom;
          decimals = defaultNetwork.tokenDecimals;
          logo = defaultNetwork.logo;
        } else if (isFactory) {
          const parts = s.denom.replace("factory/", "").split("/");
          displayName = parts[parts.length - 1]?.toUpperCase() || s.denom.slice(0, 12) + "...";
          symbol = displayName.slice(0, 6);
        } else {
          displayName = s.denom.slice(0, 12) + "...";
        }
      }

      result.push({
        denom: s.denom,
        displayName,
        symbol,
        description,
        decimals,
        totalSupply: s.amount,
        isNative,
        isIBC,
        isFactory,
        isCw20: false,
        logo,
      });
    }

    // CW20 tokens
    for (const cw of cw20Tokens) {
      result.push({
        denom: cw.contract,
        displayName: cw.name,
        symbol: cw.symbol,
        description: "CW20 Token",
        decimals: cw.decimals,
        totalSupply: cw.totalSupply,
        isNative: false,
        isIBC: false,
        isFactory: false,
        isCw20: true,
        logo: "",
        contract: cw.contract,
      });
    }

    return result.sort((a, b) => {
      if (a.isNative) return -1;
      if (b.isNative) return 1;
      if (a.isCw20 && !b.isCw20) return 1;
      if (!a.isCw20 && b.isCw20) return -1;
      return a.displayName.localeCompare(b.displayName);
    });
  }, [allSupply, metadataList, ibcAssetMap, cw20Tokens]);

  const filtered = useMemo(() => {
    let result = tokens;
    if (tab === "native") result = result.filter((t) => t.isNative);
    if (tab === "factory") result = result.filter((t) => t.isFactory);
    if (tab === "ibc") result = result.filter((t) => t.isIBC);
    if (tab === "cw20") result = result.filter((t) => t.isCw20);
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

  const nativeCount = tokens.filter((t) => t.isNative).length;
  const factoryCount = tokens.filter((t) => t.isFactory).length;
  const ibcCount = tokens.filter((t) => t.isIBC).length;
  const cw20Count = tokens.filter((t) => t.isCw20).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Coins className="h-6 w-6 text-primary" /> Tokens
        </h1>
        <p className="text-sm text-muted-foreground">
          All tokens on {defaultNetwork.displayName} — native, IBC, factory & CW20
        </p>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="flex gap-1 p-1 bg-muted/30 rounded-lg text-xs flex-wrap">
          {([
            { key: "all", label: "All", count: tokens.length },
            { key: "native", label: "Native", count: nativeCount },
            { key: "factory", label: "Factory", count: factoryCount },
            { key: "ibc", label: "IBC", count: ibcCount },
            { key: "cw20", label: "CW20", count: cw20Count },
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
      {supplyLoading ? (
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
                              : token.isCw20
                                ? "bg-cyan-500/15 text-cyan-500"
                                : "bg-violet-500/15 text-violet-500"
                        }`}
                      >
                        {token.isIBC ? <Globe className="h-5 w-5" /> : token.isCw20 ? <Code className="h-5 w-5" /> : <Coins className="h-5 w-5" />}
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
                      <Globe className="h-2.5 w-2.5 mr-1" /> IBC
                    </Badge>
                  )}
                  {token.isFactory && (
                    <Badge variant="muted" className="text-[10px]">
                      <Coins className="h-2.5 w-2.5 mr-1" /> Token Factory
                    </Badge>
                  )}
                  {token.isCw20 && (
                    <Badge variant="default" className="text-[10px] bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                      <Code className="h-2.5 w-2.5 mr-1" /> CW20
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
