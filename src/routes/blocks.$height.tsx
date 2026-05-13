import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { rpc, lcd, safe } from "@/lib/cosmos";
import { Card, Badge, Skeleton } from "@/components/shared/ui";
import { CopyButton } from "@/components/shared/CopyButton";
import { formatNumber, shorten, fmtDate, timeAgo } from "@/lib/format";
import { hexToValoper, hexToValcons, normalizeHex } from "@/lib/bech32";
import { ChevronLeft, ChevronRight, Check, X, ChevronDown } from "lucide-react";
import { JsonActions } from "@/components/shared/JsonActions";
import { useState } from "react";

export const Route = createFileRoute("/blocks/$height")({
  head: ({ params }) => ({
    meta: [
      { title: `Block #${params.height} · Jay Network Explorer` },
      { name: "description", content: `Block details for height ${params.height}.` },
    ],
  }),
  component: BlockDetail,
});

function BlockDetail() {
  const { height } = Route.useParams();
  const h = Number(height);

  const { data: block, isLoading } = useQuery({
    queryKey: ["block", h],
    queryFn: () => rpc.block(h),
  });

  const { data: txs } = useQuery({
    queryKey: ["block-txs", h],
    queryFn: () => rpc.txSearch(`tx.height=${h}`, 1, 50),
  });

  // Validator set at this height (consensus pubkey/address basis)
  const { data: valSet } = useQuery({
    queryKey: ["val-set", h],
    queryFn: () => rpc.validators(h, 1, 200),
    enabled: !!h,
  });

  // Staking validators for moniker lookup by consensus address
  const { data: stakingVals } = useQuery({
    queryKey: ["all-vals-for-block"],
    queryFn: async () => {
      const [a, b, c] = await Promise.all([
        safe(lcd.validatorsAll("BOND_STATUS_BONDED")),
        safe(lcd.validatorsAll("BOND_STATUS_UNBONDED")),
        safe(lcd.validatorsAll("BOND_STATUS_UNBONDING")),
      ]);
      return [
        ...(a?.validators ?? []),
        ...(b?.validators ?? []),
        ...(c?.validators ?? []),
      ];
    },
  });

  const b = block?.result?.block;
  const id = block?.result?.block_id;
  const proposerHex = b?.header?.proposer_address as string | undefined;
  const proposerValoper = proposerHex ? hexToValoper(proposerHex) : "";
  const proposerValcons = proposerHex ? hexToValcons(proposerHex) : "";

  // Build moniker map: valcons (from /validators rpc) → moniker via stakingVals consensus_pubkey
  // Simpler: map by hex address for signatures
  const monikerByHex = useMemo(() => {
    const m = new Map<string, { moniker: string; valoper: string }>();
    if (!valSet?.result?.validators || !stakingVals) return m;
    // valSet entries have address (hex) and pub_key
    for (const v of valSet.result.validators) {
      const hex = normalizeHex(v.address);
      // find staking validator with matching consensus pubkey
      const match = stakingVals.find(
        (sv: any) => sv.consensus_pubkey?.key === v.pub_key?.value,
      );
      m.set(hex, {
        moniker: match?.description?.moniker ?? shorten(hexToValoper(hex), 10, 6),
        valoper: match?.operator_address ?? hexToValoper(hex),
      });
    }
    return m;
  }, [valSet, stakingVals]);

  const proposerInfo = proposerHex ? monikerByHex.get(normalizeHex(proposerHex)) : undefined;

  const signatures = (b?.last_commit?.signatures ?? []) as any[];
  const signedCount = signatures.filter((s) => s.block_id_flag === 2 || s.block_id_flag === "BLOCK_ID_FLAG_COMMIT").length;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Block</div>
          <h1 className="text-2xl font-bold font-mono">#{formatNumber(h)}</h1>
        </div>
        <div className="flex gap-2">
          <Link
            to="/blocks/$height"
            params={{ height: String(h - 1) }}
            className="h-9 px-3 rounded-lg border border-border hover:bg-accent/40 inline-flex items-center gap-1 text-sm"
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </Link>
          <Link
            to="/blocks/$height"
            params={{ height: String(h + 1) }}
            className="h-9 px-3 rounded-lg border border-border hover:bg-accent/40 inline-flex items-center gap-1 text-sm"
          >
            Next <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <Card className="p-6 space-y-3">
        <Row label="Block Hash">
          <span className="font-mono text-xs break-all">{id?.hash}</span>
          <CopyButton value={id?.hash ?? ""} className="ml-2 inline-flex" />
        </Row>
        <Row label="Proposer">
          {proposerInfo?.valoper ? (
            <Link
              to="/validators/$address"
              params={{ address: proposerInfo.valoper }}
              className="text-primary hover:underline font-medium"
            >
              {proposerInfo.moniker}
            </Link>
          ) : (
            <span className="font-mono text-xs">{proposerValoper}</span>
          )}
          <div className="mt-1 space-y-0.5 text-[11px] font-mono text-muted-foreground break-all">
            <div>valoper: {proposerValoper} <CopyButton value={proposerValoper} className="inline-flex ml-1" /></div>
            <div>valcons: {proposerValcons} <CopyButton value={proposerValcons} className="inline-flex ml-1" /></div>
            <div>hex: {proposerHex}</div>
          </div>
        </Row>
        <Row label="Time">
          {fmtDate(b?.header?.time)}{" "}
          <span className="text-muted-foreground">({timeAgo(b?.header?.time)})</span>
        </Row>
        <Row label="Chain ID">
          <span className="font-mono">{b?.header?.chain_id}</span>
        </Row>
        <Row label="Transactions">{b?.data?.txs?.length ?? 0}</Row>
        <Row label="Block Size">
          <span className="font-mono">{formatNumber(JSON.stringify(b ?? {}).length)} bytes</span>
        </Row>
        <Row label="App Hash">
          <span className="font-mono text-xs break-all">{b?.header?.app_hash}</span>
        </Row>
        <Row label="Last Commit Hash">
          <span className="font-mono text-xs break-all">{b?.header?.last_commit_hash}</span>
        </Row>
        <Row label="Data Hash">
          <span className="font-mono text-xs break-all">{b?.header?.data_hash || "—"}</span>
        </Row>
        <Row label="Validators Hash">
          <span className="font-mono text-xs break-all">{b?.header?.validators_hash}</span>
        </Row>
        <Row label="Consensus Hash">
          <span className="font-mono text-xs break-all">{b?.header?.consensus_hash}</span>
        </Row>
        <Row label="Evidence">
          {b?.evidence?.evidence?.length ?? 0} item(s)
        </Row>
      </Card>

      {signatures.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold">Validator Signatures</h2>
            <span className="text-xs text-muted-foreground">
              {signedCount} / {signatures.length} signed
            </span>
          </div>
          <div className="max-h-[480px] overflow-y-auto divide-y divide-border">
            {signatures.map((s, i) => {
              const hex = s.validator_address ? normalizeHex(s.validator_address) : "";
              const info = hex ? monikerByHex.get(hex) : undefined;
              const signed =
                s.block_id_flag === 2 || s.block_id_flag === "BLOCK_ID_FLAG_COMMIT";
              return (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-accent/30"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`h-6 w-6 rounded grid place-items-center ${
                        signed ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
                      }`}
                    >
                      {signed ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                    </span>
                    {info?.valoper ? (
                      <Link
                        to="/validators/$address"
                        params={{ address: info.valoper }}
                        className="text-sm font-medium hover:text-primary truncate"
                      >
                        {info.moniker}
                      </Link>
                    ) : (
                      <span className="text-sm font-mono truncate">{shorten(hex, 10, 6)}</span>
                    )}
                  </div>
                  <Badge variant={signed ? "success" : "destructive"}>
                    {signed ? "Signed" : "Missed"}
                  </Badge>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold">Transactions</h2>
        </div>
        <div className="divide-y divide-border">
          {(txs?.result?.txs ?? []).length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              No transactions in this block
            </div>
          )}
          {(txs?.result?.txs ?? []).map((tx: any) => (
            <Link
              key={tx.hash}
              to="/transactions/$hash"
              params={{ hash: tx.hash }}
              className="flex items-center justify-between px-5 py-3 hover:bg-accent/30 transition"
            >
              <span className="font-mono text-xs">{shorten(tx.hash, 14, 10)}</span>
              <Badge variant={tx.tx_result?.code ? "destructive" : "success"}>
                {tx.tx_result?.code ? "Failed" : "Success"}
              </Badge>
            </Link>
          ))}
        </div>
      </Card>

      <RawJsonCard data={block?.result} filename={`block-${h}.json`} />
    </div>
  );
}

function RawJsonCard({ data, filename }: { data: unknown; filename: string }) {
  const [open, setOpen] = useState(false);
  if (!data) return null;
  return (
    <Card className="overflow-hidden">
      <div className="w-full px-5 py-4 flex items-center justify-between gap-3">
        <button
          onClick={() => setOpen((s) => !s)}
          className="flex items-center gap-2 hover:text-primary"
        >
          <ChevronDown
            className={`h-4 w-4 transition ${open ? "" : "-rotate-90"}`}
          />
          <span className="font-semibold">Raw JSON</span>
        </button>
        <JsonActions data={data} filename={filename} />
      </div>
      {open && (
        <pre className="px-5 py-4 text-[11px] font-mono bg-background/40 overflow-x-auto max-h-96 border-t border-border">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-1 sm:gap-4 py-2 border-b border-border last:border-0">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm break-words">{children}</div>
    </div>
  );
}
