import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { rpc, lcd, safe } from "@/lib/cosmos";
import { Card, Skeleton, Badge } from "@/components/shared/ui";
import { defaultNetwork } from "@/data/networks";
import { formatNumber, shorten } from "@/lib/format";
import { ValidatorAvatar, consAddrFromPubkey } from "@/routes/validators";
import { normalizeHex } from "@/lib/bech32";
import { fromBech32, toHex } from "@cosmjs/encoding";
import { Activity, Clock, Users, Zap } from "lucide-react";

export const Route = createFileRoute("/consensus")({
  head: () => ({
    meta: [
      { title: "Consensus · Jay Network Explorer" },
      { name: "description", content: "Live consensus state of Jay Network." },
    ],
  }),
  component: ConsensusPage,
});

function ConsensusPage() {
  const [rpcUrl, setRpcUrl] = useState(defaultNetwork.rpcs[0] + "/consensus_state");

  const { data: state, isLoading } = useQuery({
    queryKey: ["consensus-state", rpcUrl],
    queryFn: async () => {
      const res = await fetch(rpcUrl);
      return res.json();
    },
    staleTime: 5000,
    refetchInterval: 6000,
  });

  const { data: dumpState } = useQuery({
    queryKey: ["dump-consensus-state", rpcUrl],
    queryFn: async () => {
      const url = rpcUrl.replace("consensus_state", "dump_consensus_state");
      const res = await fetch(url);
      return res.json();
    },
    staleTime: 12000,
    refetchInterval: 12000,
  });

  const { data: bonded } = useQuery({
    queryKey: ["vals-bonded-consensus"],
    queryFn: () => safe(lcd.validatorsAll("BOND_STATUS_BONDED")),
    staleTime: 60000,
  });

  const round = (state as any)?.result?.round_state;
  const heightRoundStep = round?.["height/round/step"]?.split("/") ?? [];
  const height = heightRoundStep[0] ?? "—";
  const roundNum = heightRoundStep[1] ?? "—";
  const step = heightRoundStep[2] ?? "—";

  const onboardRate = useMemo(() => {
    let maxRate = 0;
    for (const voteSet of round?.height_vote_set ?? []) {
      const bitArray = voteSet.prevotes_bit_array ?? "";
      const last4 = bitArray.substring(bitArray.length - 4);
      const rate = parseInt(last4, 2) || 0;
      if (rate > maxRate) maxRate = rate;
    }
    return maxRate > 0 ? `${(maxRate * 100).toFixed()}%` : "0%";
  }, [round]);

  const stepLabel = (s: string) => {
    switch (s) {
      case "1": return "Propose";
      case "2": return "Prevote";
      case "3": return "Precommit";
      case "4": return "Commit";
      default: return `Step ${s}`;
    }
  };

  // Map hex address to validator moniker
  const hexToVal = useMemo(() => {
    const map = new Map<string, any>();
    for (const v of (bonded?.validators ?? [])) {
      const hex = consAddrFromPubkey(v.consensus_pubkey);
      if (hex) {
        try {
          map.set(toHex(fromBech32(hex).data).toUpperCase(), v);
        } catch {}
      }
    }
    return map;
  }, [bonded]);

  const positionValidators = dumpState?.result?.round_state?.validators?.validators ?? [];

  const onlineCount = useMemo(() => {
    let count = 0;
    for (const voteSet of round?.height_vote_set ?? []) {
      count += (voteSet.prevotes ?? []).filter((p: string) => p.toLowerCase() !== "nil-vote").length;
    }
    return count;
  }, [round]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* RPC Selector */}
      <Card className="card-3d p-4">
        <div className="flex gap-2">
          <select
            value={rpcUrl}
            onChange={(e) => setRpcUrl(e.target.value)}
            className="flex-1 h-10 px-3 rounded-lg bg-card border border-border text-sm focus:border-primary focus:outline-none"
          >
            {defaultNetwork.rpcs.map((url: string) => (
              <option key={url} value={url + "/consensus_state"}>
                {url}/consensus_state
              </option>
            ))}
          </select>
          <button
            onClick={() => setRpcUrl((prev) => prev)}
            className="btn-3d bg-gradient-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium"
          >
            Monitor
          </button>
        </div>
      </Card>

      {/* Stat Cards - PingPub Style */}
      {round?.["height/round/step"] && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <BigStatCard
              label="Onboard Rate"
              value={onboardRate}
              icon="O"
              color="bg-rose-100 text-red-500"
            />
            <BigStatCard
              label="Height"
              value={height}
              icon="H"
              color="bg-emerald-100 text-emerald-500"
            />
            <BigStatCard
              label="Round"
              value={roundNum}
              icon="R"
              color="bg-violet-100 text-violet-500"
            />
            <BigStatCard
              label="Step"
              value={stepLabel(step)}
              icon="S"
              color="bg-blue-100 text-blue-500"
            />
          </div>

          {/* Updated at */}
          <div className="text-sm text-red-500 font-semibold">
            Updated at {new Date().toLocaleTimeString()}
          </div>

          {/* Vote Sets */}
          {round?.height_vote_set?.map((voteSet: any, idx: number) => (
            <Card key={idx} className="card-3d p-5">
              <div className="text-xs mb-2 font-semibold">Round: {voteSet.round}</div>
              <div className="text-xs break-all font-mono mb-4 text-muted-foreground">
                {voteSet.prevotes_bit_array}
              </div>

              <div className="flex flex-wrap gap-1">
                {voteSet.prevotes?.map((pre: string, i: number) => {
                  const isNil = pre.toLowerCase() === "nil-vote";
                  const hexAddr = positionValidators[i]?.address ?? "";
                  const val = hexToVal.get(hexAddr);
                  const moniker = val?.description?.moniker ?? hexAddr.slice(0, 10) + "...";

                  const precommit = voteSet.precommits?.[i] ?? "";
                  const isPrecommitNil = precommit.toLowerCase() === "nil-vote";

                  return (
                    <div
                      key={i}
                      className="w-48 rounded-3xl h-5 text-xs px-2 text-white leading-5 flex items-center justify-between"
                      style={{ margin: 2, background: "var(--card)" }}
                    >
                      <span className="truncate text-muted-foreground">{moniker}</span>
                      <span className="flex gap-1">
                        <span
                          className={`h-3 w-3 rounded-full ${
                            isNil ? "bg-red-400" : "bg-emerald-400"
                          }`}
                          title={pre}
                        />
                        <span
                          className={`h-3 w-3 rounded-full ${
                            isPrecommitNil ? "bg-red-400" : "bg-emerald-400"
                          }`}
                          title={precommit}
                        />
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </>
      )}

      {/* Tips */}
      <Card className="p-6 border border-[#00cfe8]/20 bg-[rgba(0,207,232,0.04)]">
        <h2 className="text-base font-semibold text-[#00cfe8] mb-2">Tips</h2>
        <ul className="list-disc pl-6 space-y-1 text-sm text-muted-foreground">
          <li>
            This tool is useful for validators to monitor who is onboard during an upgrade
          </li>
          <li>
            If you want to change the default rpc endpoint, make sure that{" "}
            <code className="bg-muted px-1 rounded">https</code> and{" "}
            <code className="bg-muted px-1 rounded">CORS</code> are enabled on your server.
          </li>
        </ul>
      </Card>
    </div>
  );
}

function BigStatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: string;
  color: string;
}) {
  return (
    <Card className="card-3d p-4 flex justify-between items-center">
      <div className="flex flex-col truncate">
        <h4 className="text-xl font-bold">{value}</h4>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <div className={`w-12 h-12 rounded-full ${color} flex items-center justify-center`}>
        <span className="text-2xl font-bold">{icon}</span>
      </div>
    </Card>
  );
}
