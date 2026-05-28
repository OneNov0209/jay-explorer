// src/routes/consensus.tsx - FULL WORKING SCRIPT dengan mapping OTOMATIS

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Card } from "@/components/shared/ui";
import { defaultNetwork } from "@/data/networks";
import { formatNumber } from "@/lib/format";
import { Activity, Clock, Network, Wifi, Circle, ChevronRight, TrendingUp, BarChart3, PieChart, Zap, Award, Radio, RefreshCw } from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart as RePieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

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
  const [voteHistory, setVoteHistory] = useState<{ time: string; voted: number; total: number }[]>([]);

  const { data: state, isLoading, refetch } = useQuery({
    queryKey: ["consensus-state", rpcUrl],
    queryFn: async () => {
      const res = await fetch(rpcUrl);
      return res.json();
    },
    staleTime: 3000,
    refetchInterval: 3000,
  });

  const { data: dumpState } = useQuery({
    queryKey: ["dump-consensus-state", rpcUrl],
    queryFn: async () => {
      const url = rpcUrl.replace("consensus_state", "dump_consensus_state");
      const res = await fetch(url);
      return res.json();
    },
    staleTime: 3000,
    refetchInterval: 3000,
  });

  const { data: bonded } = useQuery({
    queryKey: ["vals-bonded-consensus"],
    queryFn: async () => {
      const res = await fetch(`${defaultNetwork.lcd}/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED&pagination.limit=150`);
      return res.json();
    },
    staleTime: 60000,
  });

  const round = (state as any)?.result?.round_state;
  const heightRoundStep = (round?.["height/round/step"]?.split("/")) || [];
  const height = heightRoundStep[0] || "—";
  const roundNum = heightRoundStep[1] || "—";
  const step = heightRoundStep[2] || "—";

  const getStepName = (stepNum: string) => {
    const steps: Record<string, { name: string; icon: any; color: string }> = {
      "0": { name: "New Round", icon: Radio, color: "text-blue-400" },
      "1": { name: "Propose", icon: Zap, color: "text-yellow-400" },
      "2": { name: "Prevote", icon: Activity, color: "text-orange-400" },
      "3": { name: "Precommit", icon: Award, color: "text-purple-400" },
      "4": { name: "Commit", icon: CheckCircle, color: "text-green-400" },
    };
    return steps[stepNum] || { name: `Step ${stepNum}`, icon: Activity, color: "text-gray-400" };
  };

  const stepInfo = getStepName(step);
  const StepIcon = stepInfo.icon;

  const onboardRate = useMemo(() => {
    let maxRate = 0;
    const voteSets = round?.height_vote_set || [];
    for (const voteSet of voteSets) {
      const bitArray = voteSet.prevotes_bit_array || "";
      const match = bitArray.match(/(\d+)\/(\d+)/);
      if (match) {
        const voted = parseInt(match[1], 10);
        const total = parseInt(match[2], 10);
        const rate = total > 0 ? (voted / total) * 100 : 0;
        if (rate > maxRate) maxRate = rate;
      }
    }
    return maxRate > 0 ? `${Math.round(maxRate)}%` : "0%";
  }, [round]);

  // 🔥 MAPPING OTOMATIS: Buat Map dari base64 pubkey ke moniker
  const pubkeyToMonikerMap = useMemo(() => {
    const map = new Map<string, string>();
    const validators = bonded?.validators || [];
    
    for (const v of validators) {
      const pubkeyBase64 = v.consensus_pubkey?.key;
      const moniker = v.description?.moniker || "Unknown";
      if (pubkeyBase64) {
        map.set(pubkeyBase64, moniker);
      }
    }
    return map;
  }, [bonded]);

  // 🔥 Ambil data validator dari dump_consensus_state
  const positionValidators = dumpState?.result?.round_state?.validators?.validators || [];
  
  // 🔥 Buat fungsi getValidatorName OTOMATIS berdasarkan pubkey dari dump
  const getValidatorName = (index: number): string => {
    const validator = positionValidators[index];
    if (!validator) return `#${index + 1}`;
    
    const pubkeyBase64 = validator.pub_key?.value;
    if (pubkeyBase64 && pubkeyToMonikerMap.has(pubkeyBase64)) {
      return pubkeyToMonikerMap.get(pubkeyBase64)!;
    }
    
    return validator.address ? validator.address.slice(0, 12) + "..." : `#${index + 1}`;
  };

  const currentVoteSet = round?.height_vote_set?.[0];
  const prevotes = currentVoteSet?.prevotes || [];
  const precommits = currentVoteSet?.precommits || [];
  const proposerIndex = round?.proposer?.index || 0;

  const activeVotes = prevotes.filter((v: string) => v?.toLowerCase() !== "nil-vote").length;
  const totalValidators = positionValidators.length;
  const activePrecommits = precommits.filter((v: string) => v?.toLowerCase() !== "nil-vote").length;

  // Update vote history for chart
  useMemo(() => {
    if (totalValidators > 0) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString();
      setVoteHistory((prev) => {
        const newHistory = [...prev, { time: timeStr, voted: activeVotes, total: totalValidators }];
        if (newHistory.length > 20) newHistory.shift();
        return newHistory;
      });
    }
  }, [activeVotes, totalValidators]);

  const voteChartData = voteHistory.map((h) => ({
    time: h.time,
    voted: h.voted,
    missed: h.total - h.voted,
  }));

  // Voting power data for chart
  const votingPowerData = useMemo(() => {
    const topValidators = positionValidators.slice(0, 10).map((v: any, i: number) => ({
      name: getValidatorName(i),
      power: parseInt(v?.voting_power || "0", 10),
    })).sort((a, b) => b.power - a.power);
    
    return topValidators;
  }, [positionValidators]);

  const COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#14b8a6", "#a855f7", "#eab308"];

  const stepDistribution = [
    { name: "Prevotes", value: activeVotes, fill: "#f59e0b" },
    { name: "Missed Prevotes", value: totalValidators - activeVotes, fill: "#ef4444" },
    { name: "Precommits", value: activePrecommits, fill: "#10b981" },
    { name: "Missed Precommits", value: totalValidators - activePrecommits, fill: "#ef4444" },
  ];

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="animate-pulse">
          <div className="h-12 w-64 bg-slate-800/50 rounded-lg mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 bg-slate-800/50 rounded-2xl"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="h-80 bg-slate-800/50 rounded-2xl"></div>
            <div className="h-80 bg-slate-800/50 rounded-2xl"></div>
          </div>
          <div className="h-96 bg-slate-800/50 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-2 rounded-xl">
            <Network className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Consensus State</h1>
            <p className="text-slate-400 text-sm mt-1 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              Live real-time monitoring • Update every 3s
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="relative">
            <select
              value={rpcUrl}
              onChange={(e) => setRpcUrl(e.target.value)}
              className="appearance-none bg-slate-800/80 backdrop-blur-sm border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
            >
              {defaultNetwork.rpcs.map((url: string) => (
                <option key={url} value={url + "/consensus_state"}>
                  {url}/consensus_state
                </option>
              ))}
            </select>
            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none rotate-90" />
          </div>
          <button
            onClick={() => refetch()}
            className="bg-slate-800/80 backdrop-blur-sm border border-slate-700 hover:bg-slate-700 transition-all text-white rounded-xl px-4 py-2 text-sm font-medium flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {round?.["height/round/step"] && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Onboard Rate" value={onboardRate} icon="O" gradient="from-rose-500 to-red-500" />
            <StatCard label="Height" value={formatNumber(Number(height))} icon="H" gradient="from-emerald-500 to-teal-500" />
            <StatCard label="Round" value={roundNum} icon="R" gradient="from-violet-500 to-purple-500" />
            <StatCard label="Step" value={stepInfo.name} icon={StepIcon} gradient="from-blue-500 to-cyan-500" stepColor={stepInfo.color} />
          </div>

          {/* Live Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Wifi className="h-5 w-5 text-green-400" />
                  <span className="text-slate-300 text-sm">Network Sync</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-green-400 text-xs">Live</span>
                </div>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold text-white">{height}</div>
                <div className="text-xs text-slate-500">Latest Block</div>
              </div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 p-4">
              <div className="flex items-center gap-3 mb-2">
                <Activity className="h-5 w-5 text-blue-400" />
                <span className="text-slate-300 text-sm">Active Validators</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white">{activeVotes}</span>
                <span className="text-slate-500 text-sm">/ {totalValidators}</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-1.5 mt-2">
                <div 
                  className="bg-gradient-to-r from-green-400 to-blue-500 h-1.5 rounded-full transition-all duration-300" 
                  style={{ width: `${(activeVotes / totalValidators) * 100}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 p-4">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="h-5 w-5 text-purple-400" />
                <span className="text-slate-300 text-sm">Last Update</span>
              </div>
              <div className="text-xl font-mono text-white">{new Date().toLocaleTimeString()}</div>
              <div className="text-xs text-slate-500 mt-1">Real-time every 3 seconds</div>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5 text-blue-400" />
                <h3 className="text-white font-semibold">Vote History (Last 20 updates)</h3>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={voteChartData}>
                  <defs>
                    <linearGradient id="votedGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="missedGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} tick={{ fill: "#94a3b8" }} />
                  <YAxis stroke="#94a3b8" fontSize={10} tick={{ fill: "#94a3b8" }} />
                  <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }} />
                  <Legend wrapperStyle={{ color: "#cbd5e1" }} />
                  <Area type="monotone" dataKey="voted" stroke="#10b981" fill="url(#votedGradient)" name="Voted" />
                  <Area type="monotone" dataKey="missed" stroke="#ef4444" fill="url(#missedGradient)" name="Missed" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-5 w-5 text-purple-400" />
                <h3 className="text-white font-semibold">Top Validators by Voting Power</h3>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={votingPowerData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" stroke="#94a3b8" fontSize={10} tick={{ fill: "#94a3b8" }} />
                  <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={10} tick={{ fill: "#94a3b8" }} width={120} />
                  <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }} formatter={(value: number) => value.toLocaleString()} />
                  <Bar dataKey="power" fill="#8b5cf6" radius={[0, 4, 4, 0]}>
                    {votingPowerData.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pie Chart + Live Status */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 p-5">
              <div className="flex items-center gap-2 mb-4">
                <PieChart className="h-5 w-5 text-pink-400" />
                <h3 className="text-white font-semibold">Current Round Vote Distribution</h3>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <RePieChart>
                  <Pie
                    data={stepDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {stepDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                    formatter={(value: number) => `${value} votes`}
                  />
                  <Legend wrapperStyle={{ color: "#cbd5e1" }} />
                </RePieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="h-5 w-5 text-green-400 animate-pulse" />
                <h3 className="text-white font-semibold">Live Voting Status</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-400">Prevotes</span>
                    <span className="text-white">{activeVotes} / {totalValidators}</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div className="bg-gradient-to-r from-orange-500 to-yellow-500 h-2 rounded-full transition-all duration-300" style={{ width: `${(activeVotes / totalValidators) * 100}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-400">Precommits</span>
                    <span className="text-white">{activePrecommits} / {totalValidators}</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all duration-300" style={{ width: `${(activePrecommits / totalValidators) * 100}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-400">Consensus Progress</span>
                    <span className="text-white">{onboardRate}</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300" style={{ width: onboardRate }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Vote Display - WITH VALIDATOR NAMES (AUTOMATIC) */}
          {round?.height_vote_set?.map((voteSet: any, idx: number) => (
            <Card key={idx} className="overflow-hidden bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl mb-6">
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full"></div>
                    <h3 className="text-lg font-semibold text-white">Round {voteSet.round}</h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="flex items-center gap-1"><Circle className="h-2 w-2 text-green-400 fill-green-400" /><span className="text-slate-400">Voted</span></span>
                    <span className="flex items-center gap-1"><Circle className="h-2 w-2 text-red-500 fill-red-500" /><span className="text-slate-400">Missed</span></span>
                    <span className="flex items-center gap-1"><Circle className="h-2 w-2 text-yellow-500 fill-yellow-500" /><span className="text-slate-400">Proposer</span></span>
                  </div>
                </div>

                <div className="text-xs font-mono break-all mb-4 text-slate-400 bg-slate-900/50 p-3 rounded-xl">
                  {voteSet.prevotes_bit_array}
                </div>

                <div className="flex flex-wrap gap-2 max-h-[600px] overflow-y-auto">
                  {voteSet.prevotes?.map((pre: string, i: number) => {
                    const isNil = pre.toLowerCase() === "nil-vote";
                    const isPrecommitNil = voteSet.precommits?.[i]?.toLowerCase() === "nil-vote";
                    const isProposer = i === proposerIndex;
                    
                    // 🔥 AUTO GET VALIDATOR NAME from positionValidators
                    const validatorName = getValidatorName(i);
                    
                    let bgColor = "bg-slate-700";
                    if (!isNil) bgColor = "bg-gradient-to-r from-green-500 to-emerald-500";
                    if (isNil && isProposer) bgColor = "bg-gradient-to-r from-yellow-500 to-orange-500";
                    if (isNil && !isProposer) bgColor = "bg-gradient-to-r from-red-500 to-rose-500";

                    return (
                      <div key={i} className="group relative w-52 rounded-xl overflow-hidden transition-all duration-300 hover:scale-105">
                        <div className={`relative ${bgColor} p-2 rounded-xl`}>
                          <div className="flex items-center justify-between">
                            <span className="truncate text-white text-xs font-medium" title={validatorName}>
                              {validatorName}
                            </span>
                            <div className="flex gap-1.5">
                              <div className="relative group/tooltip">
                                <div className={`w-2.5 h-2.5 rounded-full ${isNil ? 'bg-red-400' : 'bg-green-400'} ${isProposer ? 'ring-2 ring-yellow-400' : ''}`} />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-slate-900 text-white text-xs rounded opacity-0 group-hover/tooltip:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                                  Prevote: {pre?.slice(0, 30)}...
                                </div>
                              </div>
                              <div className="relative group/tooltip">
                                <div className={`w-2.5 h-2.5 rounded-full ${isPrecommitNil ? 'bg-red-400' : 'bg-green-400'}`} />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-slate-900 text-white text-xs rounded opacity-0 group-hover/tooltip:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                                  Precommit: {voteSet.precommits?.[i]?.slice(0, 30)}...
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}

// Stat Card Component
function StatCard({ label, value, icon, gradient, stepColor }: { label: string; value: string; icon: any; gradient: string; stepColor?: string }) {
  const IconComponent = typeof icon === 'string' ? () => <span className="text-2xl font-bold">{icon}</span> : icon;
  return (
    <div className="relative group bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 p-5 overflow-hidden transition-all duration-300 hover:scale-105">
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>
      <div className="relative flex justify-between items-start">
        <div>
          <p className="text-slate-400 text-sm tracking-wide mb-2">{label}</p>
          <p className={`text-3xl font-bold ${stepColor || 'text-white'} transition-all duration-300 group-hover:scale-105 origin-left`}>{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}>
          {typeof icon === 'string' ? <span className="text-white text-xl font-bold">{icon}</span> : <IconComponent className="h-6 w-6 text-white" />}
        </div>
      </div>
      <div className={`absolute bottom-0 left-0 h-0.5 bg-gradient-to-r ${gradient} w-0 group-hover:w-full transition-all duration-300`}></div>
    </div>
  );
}

// CheckCircle component
function CheckCircle(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
