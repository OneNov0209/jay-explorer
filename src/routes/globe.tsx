import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { lcd, safe } from "@/lib/cosmos";
import { defaultNetwork } from "@/data/networks";
import { Card } from "@/components/shared/ui";
import { formatAmount } from "@/lib/format";

export const Route = createFileRoute("/globe")({
  head: () => ({
    meta: [{ title: "Network Globe · Jay Network Explorer" }],
  }),
  component: GlobePage,
});

// Distribute validators around the globe deterministically (no real geo-IP).
function pseudoLocations(count: number) {
  const arr: Array<{ lat: number; lng: number }> = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / Math.max(1, count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    const lat = (Math.asin(y) * 180) / Math.PI;
    const lng = (Math.atan2(z, x) * 180) / Math.PI;
    arr.push({ lat, lng });
  }
  return arr;
}

function extractHost(url?: string) {
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch {
    return url.replace(/^https?:\/\//, "").split("/")[0];
  }
}

function isIp(host: string) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

async function probeEndpoint(rpc: string) {
  const t0 = performance.now();
  const res = await fetch(`${rpc}/status`, { headers: { Accept: "application/json" } });
  const latency = Math.round(performance.now() - t0);
  if (!res.ok) throw new Error(`${res.status}`);
  const json = await res.json();
  const ni = json?.result?.node_info ?? {};
  const si = json?.result?.sync_info ?? {};
  return {
    moniker: ni.moniker as string | undefined,
    network: ni.network as string | undefined,
    listenAddr: ni.listen_addr as string | undefined,
    version: ni.version as string | undefined,
    nodeId: ni.id as string | undefined,
    latestHeight: si.latest_block_height as string | undefined,
    catchingUp: !!si.catching_up,
    latency,
  };
}

function GlobePage() {
  const [Globe, setGlobe] = useState<any>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 600, h: 500 });

  useEffect(() => {
    let mounted = true;
    import("react-globe.gl").then((m) => {
      if (mounted) setGlobe(() => m.default);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(() => {
      const r = wrapRef.current!.getBoundingClientRect();
      setSize({ w: r.width, h: Math.max(420, Math.min(700, r.width * 0.75)) });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const { data: validators } = useQuery({
    queryKey: ["globe-validators"],
    queryFn: () => safe(lcd.validatorsAll()),
    refetchInterval: 60_000,
  });

  // Live probe each configured endpoint to detect server name + IP + sync state
  const endpointProbes = useQueries({
    queries: defaultNetwork.endpoints
      .filter((e) => !!e.rpc)
      .map((e) => ({
        queryKey: ["endpoint-probe", e.rpc],
        queryFn: async () => {
          try {
            const info = await probeEndpoint(e.rpc!);
            return { ok: true as const, ...info };
          } catch (err: any) {
            return { ok: false as const, error: String(err?.message ?? err) };
          }
        },
        refetchInterval: 10_000,
        staleTime: 5_000,
      })),
  });

  const points = useMemo(() => {
    const list = (validators?.validators ?? []) as any[];
    const sorted = [...list].sort(
      (a, b) => Number(b.tokens) - Number(a.tokens),
    );
    const locs = pseudoLocations(sorted.length);
    const max = Number(sorted[0]?.tokens ?? 1);
    return sorted.map((v: any, i: number) => ({
      ...locs[i],
      moniker: v.description?.moniker ?? "validator",
      tokens: v.tokens,
      size: 0.2 + (Number(v.tokens) / max) * 1.4,
      color:
        v.status === "BOND_STATUS_BONDED"
          ? "rgba(140, 100, 255, 0.95)"
          : "rgba(255, 80, 100, 0.7)",
    }));
  }, [validators]);

  // Animated arcs: each validator connects to a hub (top voting power) and
  // a few neighboring peers — mimicking a P2P mesh.
  const arcs = useMemo(() => {
    if (points.length < 2) return [];
    const hub = points[0];
    const result: any[] = [];
    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      result.push({
        startLat: hub.lat,
        startLng: hub.lng,
        endLat: p.lat,
        endLng: p.lng,
        color: ["rgba(56,189,248,0.0)", "rgba(140,100,255,0.9)", "rgba(56,189,248,0.0)"],
      });
      // peer link to next neighbor
      const next = points[(i + 1) % points.length];
      if (next) {
        result.push({
          startLat: p.lat,
          startLng: p.lng,
          endLat: next.lat,
          endLng: next.lng,
          color: ["rgba(167,139,250,0.0)", "rgba(56,189,248,0.7)", "rgba(167,139,250,0.0)"],
        });
      }
    }
    return result;
  }, [points]);

  const rings = useMemo(
    () =>
      points.slice(0, 8).map((p) => ({
        lat: p.lat,
        lng: p.lng,
        maxR: 5,
        propagationSpeed: 2,
        repeatPeriod: 1600,
      })),
    [points],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Network Globe</h1>
        <p className="text-sm text-muted-foreground">
          {defaultNetwork.displayName} validator distribution with live P2P-style
          connection arcs. Pin sizes scale with voting power.
        </p>
      </div>

      <Card className="p-4 overflow-hidden">
        <div ref={wrapRef} className="w-full grid place-items-center">
          {Globe ? (
            <Globe
              width={size.w}
              height={size.h}
              backgroundColor="rgba(0,0,0,0)"
              globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
              bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
              atmosphereColor="#8c64ff"
              atmosphereAltitude={0.22}
              pointsData={points}
              pointLat="lat"
              pointLng="lng"
              pointColor="color"
              pointAltitude={(d: any) => 0.02 + d.size * 0.05}
              pointRadius={(d: any) => d.size}
              pointLabel={(d: any) =>
                `<div style="font-family:ui-sans-serif;font-size:12px;background:rgba(15,15,30,0.92);padding:6px 8px;border-radius:6px;border:1px solid rgba(140,100,255,0.45);">
                   <div style="font-weight:600">${d.moniker}</div>
                   <div style="opacity:0.7">${formatAmount(d.tokens, { precision: 0 })}</div>
                 </div>`
              }
              arcsData={arcs}
              arcColor={"color"}
              arcStroke={0.4}
              arcDashLength={0.35}
              arcDashGap={1.2}
              arcDashAnimateTime={2200}
              arcAltitudeAutoScale={0.5}
              ringsData={rings}
              ringColor={() => (t: number) => `rgba(56,189,248,${1 - t})`}
              ringMaxRadius="maxR"
              ringPropagationSpeed="propagationSpeed"
              ringRepeatPeriod="repeatPeriod"
            />
          ) : (
            <div
              style={{ width: size.w, height: size.h }}
              className="grid place-items-center text-sm text-muted-foreground"
            >
              Loading globe…
            </div>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Connected Endpoints</h2>
          <span className="text-xs text-muted-foreground">
            Live · refresh every 10s
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {defaultNetwork.endpoints.map((ep, idx) => {
            const probe = endpointProbes[idx]?.data as any;
            const host = extractHost(ep.rpc);
            const ipLike = isIp(host);
            const ok = probe?.ok;
            return (
              <div
                key={ep.name}
                className="card-3d p-4 relative overflow-hidden"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-full ${
                          ok
                            ? "bg-emerald-400 animate-pulse-dot"
                            : probe
                              ? "bg-red-400"
                              : "bg-muted-foreground/50"
                        }`}
                      />
                      <span className="font-semibold truncate">{ep.name}</span>
                      {ok && probe?.moniker && (
                        <span className="text-xs text-muted-foreground truncate">
                          · {probe.moniker}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-mono text-muted-foreground truncate">
                      {ipLike ? "IP" : "Host"}: <span className="text-foreground">{host}</span>
                    </div>
                    {ep.p2p && (
                      <div className="text-xs text-mono text-muted-foreground truncate">
                        P2P: <span className="text-foreground">{ep.p2p}</span>
                      </div>
                    )}
                    {ok && probe?.listenAddr && (
                      <div className="text-xs text-mono text-muted-foreground truncate">
                        Listen: <span className="text-foreground">{probe.listenAddr}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {ok ? (
                      <>
                        <div className="text-xs text-emerald-400">{probe.latency} ms</div>
                        {probe.latestHeight && (
                          <div className="text-xs text-mono text-muted-foreground">
                            #{Number(probe.latestHeight).toLocaleString()}
                          </div>
                        )}
                        {probe.version && (
                          <div className="text-[10px] text-muted-foreground">
                            v{probe.version}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-xs text-red-400">offline</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold mb-2">About</h2>
        <p className="text-sm text-muted-foreground">
          Validator pin positions are mathematically distributed (P2P IPs are not
          published on-chain). Animated arcs visualize a stylized mesh between
          the hub (top voting power) and peers. The endpoint panel performs live
          probes against each configured RPC, detecting the node moniker, IP /
          hostname, listen address, version, latency, and current block height.
        </p>
      </Card>
    </div>
  );
}
