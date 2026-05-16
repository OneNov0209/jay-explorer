import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueries } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { lcd, safe } from "@/lib/cosmos";
import { defaultNetwork } from "@/data/networks";
import { Card, Badge, Skeleton } from "@/components/shared/ui";
import { formatAmount, pct, shorten } from "@/lib/format";
import { Search, Shield } from "lucide-react";
import { useKeybaseAvatar } from "@/hooks/use-keybase";
import { fromBase64, toBech32 } from "@cosmjs/encoding";
import { Sha256 } from "@cosmjs/crypto";

export const Route = createFileRoute("/validators")({
  head: () => ({
    meta: [
      { title: "Validators · Jay Network Explorer" },
      { name: "description", content: "Active and inactive validators on Jay Network." },
    ],
  }),
  component: ValidatorsRouteComponent,
});

export type Filter = "active" | "inactive" | "jailed" | "uptime" | "all";

function ValidatorsRouteComponent() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return path === "/validators" ? <ValidatorsPage /> : <Outlet />;
}

export function ValidatorsPage({ initialFilter = "active" }: { initialFilter?: Filter } = {}) {
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [q, setQ] = useState("");

  const { data: bonded, isLoading: l1 } = useQuery({
    queryKey: ["vals-bonded"],
    queryFn: () => safe(lcd.validatorsAll("BOND_STATUS_BONDED")),
  });
  const { data: unbonded } = useQuery({
    queryKey: ["vals-unbonded"],
    queryFn: () => safe(lcd.validatorsAll("BOND_STATUS_UNBONDED")),
    enabled: filter !== "active" && filter !== "uptime",
  });
  const { data: unbonding } = useQuery({
    queryKey: ["vals-unbonding"],
    queryFn: () => safe(lcd.validatorsAll("BOND_STATUS_UNBONDING")),
    enabled: filter === "all" || filter === "jailed",
  });
  const { data: pool } = useQuery({
    queryKey: ["pool"],
    queryFn: () => safe(lcd.pool()),
  });
  const { data: signing } = useQuery({
    queryKey: ["signing-infos"],
    queryFn: () => safe(lcd.signingInfos()),
    refetchInterval: 30_000,
  });
  const { data: slashingParams } = useQuery({
    queryKey: ["slashing-params"],
    queryFn: () => safe(lcd.slashingParams()),
  });

  const signedWindow = Number(slashingParams?.params?.signed_blocks_window ?? 10000);

  // Build a lookup: valcons -> { missed, tombstoned }
  const signMap = useMemo(() => {
    const m = new Map<string, { missed: number; jailedUntil?: string }>();
    for (const s of signing?.info ?? []) {
      m.set(s.address, {
        missed: Number(s.missed_blocks_counter ?? 0),
        jailedUntil: s.jailed_until,
      });
    }
    return m;
  }, [signing]);

  const list = useMemo(() => {
    const merged = [
      ...(bonded?.validators ?? []),
      ...(unbonded?.validators ?? []),
      ...(unbonding?.validators ?? []),
    ];
    const all =
      filter === "active" || filter === "uptime"
        ? bonded?.validators ?? []
        : filter === "inactive"
          ? (unbonded?.validators ?? []).filter((v: any) => !v.jailed)
          : filter === "jailed"
            ? merged.filter((v: any) => v.jailed)
            : merged;

    let sorted = [...all].sort((a: any, b: any) => Number(b.tokens) - Number(a.tokens));

    if (filter === "uptime") {
      // Recompute by uptime score (lower missed = better)
      sorted = sorted
        .map((v: any) => {
          const valcons = consAddrFromPubkey(v.consensus_pubkey);
          const info = valcons ? signMap.get(valcons) : undefined;
          const missed = info?.missed ?? 0;
          const uptime = signedWindow > 0 ? Math.max(0, 1 - missed / signedWindow) : 1;
          return { v, uptime };
        })
        .sort((a, b) => b.uptime - a.uptime)
        .map((x) => x.v);
    }

    return q
      ? sorted.filter(
          (v: any) =>
            v.description?.moniker?.toLowerCase().includes(q.toLowerCase()) ||
            v.operator_address?.toLowerCase().includes(q.toLowerCase()),
        )
      : sorted;
  }, [bonded, unbonded, unbonding, filter, q, signMap, signedWindow]);

  const totalBonded = Number(pool?.pool?.bonded_tokens ?? 0);

  // Fetch delegations per validator untuk 24h changes
  const valDelegations = useQueries({
    queries: list.slice(0, 100).map((v: any) => ({
      queryKey: ["val-delegations-24h", v.operator_address],
      queryFn: () => safe(lcd.validatorDelegations(v.operator_address)),
      staleTime: 5 * 60_000,
      enabled: !l1 && list.length > 0,
    })),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Validators</h1>
        <p className="text-sm text-muted-foreground">
          {defaultNetwork.displayName} validator set
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex flex-wrap gap-1 p-1 bg-card border border-border rounded-lg">
          {(
            initialFilter === "uptime"
              ? (["uptime", "active", "inactive", "jailed", "all"] as Filter[])
              : (["active", "inactive", "jailed", "all"] as Filter[])
          ).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs rounded-md capitalize transition ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-sm">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by moniker or address"
            className="w-full pl-10 pr-3 h-9 text-sm rounded-lg bg-card border border-border focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-5 py-3 font-medium">#</th>
                <th className="text-left px-5 py-3 font-medium">Moniker</th>
                <th className="text-right px-5 py-3 font-medium">Voting Power</th>
                <th className="text-right px-5 py-3 font-medium">24h Changes</th>
                <th className="text-right px-5 py-3 font-medium">Commission</th>
                <th className="text-right px-5 py-3 font-medium">Uptime</th>
                <th className="text-right px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {l1
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={7} className="px-5 py-3">
                        <Skeleton className="h-5 w-full" />
                      </td>
                    </tr>
                  ))
                : list.map((v: any, i: number) => {
                    const tokens = Number(v.tokens);
                    const status = v.jailed
                      ? "jailed"
                      : v.status === "BOND_STATUS_BONDED"
                        ? "active"
                        : "inactive";
                    const valcons = consAddrFromPubkey(v.consensus_pubkey);
                    const info = valcons ? signMap.get(valcons) : undefined;
                    const missed = info?.missed ?? 0;
                    const uptime =
                      status === "active" && signedWindow > 0
                        ? Math.max(0, 1 - missed / signedWindow)
                        : null;
                    const idx = list.indexOf(v);
                    const dels = valDelegations[idx]?.data?.delegation_responses ?? [];
                    const totalDelegated = dels.reduce(
                      (s: number, d: any) => s + Number(d.balance?.amount ?? 0),
                      0,
                    );
                    return (
                      <tr
                        key={v.operator_address}
                        className="border-t border-border hover:bg-accent/30 transition"
                      >
                        <td className="px-5 py-3 text-muted-foreground tabular-nums">
                          {i + 1}
                        </td>
                        <td className="px-5 py-3">
                          <Link
                            to="/validators/$address"
                            params={{ address: v.operator_address }}
                            className="flex items-center gap-3 group"
                          >
                            <ValidatorAvatar
                              identity={v.description?.identity}
                              moniker={v.description?.moniker}
                            />
                            <div>
                              <div className="font-medium group-hover:text-primary transition">
                                {v.description?.moniker || shorten(v.operator_address)}
                              </div>
                              <div className="text-[11px] text-muted-foreground font-mono">
                                {shorten(v.operator_address, 10, 6)}
                              </div>
                            </div>
                          </Link>
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-xs">
                          {formatAmount(tokens, { precision: 0 })}
                        </td>
                        <td className="px-5 py-3 text-right text-xs">
                          {totalDelegated > 0 ? (
                            <span className="text-success font-mono">
                              +{formatAmount(totalDelegated, { precision: 0 })} JAY
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right text-xs">
                          {pct(Number(v.commission?.commission_rates?.rate ?? 0))}
                        </td>
                        <td className="px-5 py-3 text-right text-xs">
                          {uptime === null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <UptimePill uptime={uptime} />
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Badge
                            variant={
                              status === "active"
                                ? "success"
                                : status === "jailed"
                                  ? "destructive"
                                  : "muted"
                            }
                          >
                            {status}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function ValidatorAvatar({
  identity,
  moniker,
  size = 32,
}: {
  identity?: string;
  moniker?: string;
  size?: number;
}) {
  const { data: avatar } = useKeybaseAvatar(identity);
  if (avatar) {
    return (
      <img
        src={avatar}
        alt={moniker ?? "validator"}
        style={{ width: size, height: size }}
        className="rounded-full ring-2 ring-primary/30 object-cover bg-card"
        loading="lazy"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-full bg-primary/15 grid place-items-center text-primary"
    >
      <Shield className="h-4 w-4" />
    </div>
  );
}

export function UptimePill({ uptime }: { uptime: number }) {
  const color =
    uptime >= 0.99
      ? "bg-success/20 text-success border-success/40"
      : uptime >= 0.95
        ? "bg-warning/20 text-warning border-warning/40"
        : "bg-destructive/20 text-destructive border-destructive/40";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono border ${color}`}
    >
      {(uptime * 100).toFixed(2)}%
    </span>
  );
}

/** Convert a CometBFT consensus pubkey to a valcons bech32. */
export function consAddrFromPubkey(pubkey: any): string | null {
  try {
    if (!pubkey) return null;
    const key: string | undefined = pubkey.key;
    if (!key) return null;
    const raw = fromBase64(key);
    const hash = new Sha256(raw).digest();
    return toBech32(defaultNetwork.bech32Config.bech32PrefixConsAddr, hash.slice(0, 20));
  } catch {
    return null;
  }
}
