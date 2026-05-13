import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { rpc } from "@/lib/cosmos";
import { Card, Badge, Skeleton } from "@/components/shared/ui";
import { CopyButton } from "@/components/shared/CopyButton";
import { formatAmount, formatNumber, fmtDate, shorten, timeAgo } from "@/lib/format";
import { decodeTx, messageToJSON } from "@/lib/decodeTx";
import { JsonActions } from "@/components/shared/JsonActions";
import { defaultNetwork } from "@/data/networks";
import { ChevronDown, ChevronRight, Hash, Layers, Receipt, Send } from "lucide-react";

export const Route = createFileRoute("/transactions/$hash")({
  head: ({ params }) => ({
    meta: [{ title: `Tx ${params.hash.slice(0, 12)}… · Jay Network Explorer` }],
  }),
  component: TxDetail,
});

function TxDetail() {
  const { hash } = Route.useParams();
  const [showRaw, setShowRaw] = useState(false);
  const [openMsgs, setOpenMsgs] = useState<Record<number, boolean>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["tx", hash],
    queryFn: () => rpc.tx(hash),
    retry: 1,
  });

  // Fetch the block for timestamp
  const blockHeight = data?.result?.height;
  const { data: blk } = useQuery({
    queryKey: ["tx-block", blockHeight],
    queryFn: () => rpc.block(blockHeight!),
    enabled: !!blockHeight,
  });

  const decoded = useMemo(() => {
    const b64 = data?.result?.tx;
    if (!b64) return null;
    return decodeTx(b64);
  }, [data]);

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  const tx = data?.result;
  if (!tx)
    return (
      <Card className="p-8 text-center text-muted-foreground">Transaction not found.</Card>
    );

  const success = !tx.tx_result?.code;
  const events = tx.tx_result?.events ?? [];
  const time = blk?.result?.block?.header?.time;

  const feeAmount = decoded?.fee?.amount?.[0];
  const gasLimit = decoded?.fee?.gasLimit ?? tx.tx_result?.gas_wanted;
  const gasUsed = tx.tx_result?.gas_used;
  const efficiency =
    gasUsed && gasLimit
      ? ((Number(gasUsed) / Number(gasLimit)) * 100).toFixed(1)
      : null;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Hash className="h-3 w-3" /> Transaction
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <h1 className="text-base sm:text-lg font-mono break-all">{tx.hash}</h1>
          <CopyButton value={tx.hash} />
        </div>
      </div>

      {/* Summary card */}
      <Card className="p-6 grid sm:grid-cols-2 gap-4">
        <Row label="Status">
          <Badge variant={success ? "success" : "destructive"}>
            {success ? "Success" : `Failed (code ${tx.tx_result.code})`}
          </Badge>
          {!success && tx.tx_result?.log && (
            <div className="mt-2 text-xs text-destructive font-mono break-all">
              {tx.tx_result.log}
            </div>
          )}
        </Row>
        <Row label="Block">
          <Link
            to="/blocks/$height"
            params={{ height: String(tx.height) }}
            className="text-primary hover:underline font-mono inline-flex items-center gap-1"
          >
            <Layers className="h-3.5 w-3.5" />#{formatNumber(tx.height)}
          </Link>
        </Row>
        <Row label="Time">
          {time ? (
            <>
              {fmtDate(time)}{" "}
              <span className="text-muted-foreground">({timeAgo(time)})</span>
            </>
          ) : (
            "—"
          )}
        </Row>
        <Row label="Index">{tx.index}</Row>
        <Row label="Gas (used / wanted)">
          <span className="font-mono text-xs">
            {formatNumber(gasUsed)} / {formatNumber(gasLimit)}
            {efficiency && (
              <span className="ml-2 text-muted-foreground">({efficiency}%)</span>
            )}
          </span>
          <div className="mt-1 h-1.5 w-full max-w-xs rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/60"
              style={{
                width: `${Math.min(100, Number(efficiency ?? 0))}%`,
              }}
            />
          </div>
        </Row>
        <Row label="Fee">
          {feeAmount ? (
            <span className="font-mono text-sm">
              {formatAmount(feeAmount.amount, {
                decimals: defaultNetwork.tokenDecimals,
                symbol: defaultNetwork.coinDenom,
              })}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
          {decoded?.fee?.payer && (
            <div className="mt-1 text-xs text-muted-foreground font-mono">
              payer: {shorten(decoded.fee.payer, 14, 8)}
            </div>
          )}
          {decoded?.fee?.granter && (
            <div className="text-xs text-muted-foreground font-mono">
              granter: {shorten(decoded.fee.granter, 14, 8)}
            </div>
          )}
        </Row>
        {decoded?.memo && (
          <Row label="Memo">
            <span className="text-sm break-all">{decoded.memo}</span>
          </Row>
        )}
        {decoded?.signers && decoded.signers.length > 0 && (
          <Row label="Signers">
            <div className="space-y-1">
              {decoded.signers.map((s, i) => (
                <div key={i} className="text-xs font-mono flex items-center gap-2">
                  {s.address ? (
                    <Link
                      to="/accounts/$address"
                      params={{ address: s.address }}
                      className="text-primary hover:underline"
                    >
                      {shorten(s.address, 16, 10)}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">unknown</span>
                  )}
                  <span className="text-muted-foreground">seq #{s.sequence}</span>
                </div>
              ))}
            </div>
          </Row>
        )}
      </Card>

      {/* Messages */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold inline-flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" /> Messages
            <span className="text-xs font-normal text-muted-foreground">
              ({decoded?.messages?.length ?? 0})
            </span>
          </h2>
        </div>
        <div className="divide-y divide-border">
          {(decoded?.messages ?? []).length === 0 && (
            <div className="px-5 py-8 text-sm text-muted-foreground text-center">
              No decoded messages
            </div>
          )}
          {(decoded?.messages ?? []).map((m, i) => {
            const isOpen = openMsgs[i] ?? i === 0;
            const json = m.value ? messageToJSON(m.value) : null;
            return (
              <div key={i}>
                <button
                  onClick={() => setOpenMsgs((p) => ({ ...p, [i]: !isOpen }))}
                  className="w-full px-5 py-3 flex items-center justify-between gap-3 hover:bg-accent/30 text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs text-muted-foreground font-mono">
                      #{i + 1}
                    </span>
                    <Badge>{m.short}</Badge>
                    <span className="text-xs text-muted-foreground font-mono truncate">
                      {m.typeUrl}
                    </span>
                  </div>
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-5 pb-4">
                    {json ? (
                      <MessageRenderer typeUrl={m.typeUrl} value={json} />
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        Could not decode this message type.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Events */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold inline-flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" /> Events
            <span className="text-xs font-normal text-muted-foreground">
              ({events.length})
            </span>
          </h2>
        </div>
        <div className="divide-y divide-border max-h-[480px] overflow-y-auto">
          {events.map((ev: any, i: number) => (
            <div key={i} className="px-5 py-3">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="muted">{ev.type}</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs font-mono text-muted-foreground">
                {(ev.attributes ?? []).map((a: any, j: number) => {
                  const k = maybeB64(a.key);
                  const v = maybeB64(a.value);
                  return (
                    <div key={j} className="truncate">
                      <span className="text-foreground/70">{k}:</span> {v}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Raw */}
      <Card className="overflow-hidden">
        <div className="w-full px-5 py-4 flex items-center justify-between gap-3">
          <button
            onClick={() => setShowRaw((s) => !s)}
            className="flex items-center gap-2 hover:text-primary"
          >
            <ChevronDown
              className={`h-4 w-4 transition ${showRaw ? "" : "-rotate-90"}`}
            />
            <span className="font-semibold">Raw JSON</span>
          </button>
          <div className="flex items-center gap-2">
            {decoded && (
              <JsonActions
                data={messageToJSON({
                  hash: tx.hash,
                  height: tx.height,
                  memo: decoded.memo,
                  fee: decoded.fee,
                  signers: decoded.signers,
                  messages: decoded.messages.map((m) => ({
                    typeUrl: m.typeUrl,
                    value: m.value,
                  })),
                })}
                filename={`tx-${tx.hash.slice(0, 12)}-decoded.json`}
              />
            )}
            <JsonActions data={tx} filename={`tx-${tx.hash.slice(0, 12)}-raw.json`} />
          </div>
        </div>
        {showRaw && (
          <pre className="px-5 py-4 text-[11px] font-mono bg-background/40 overflow-x-auto max-h-96 border-t border-border">
            {JSON.stringify(tx, null, 2)}
          </pre>
        )}
      </Card>
    </div>
  );
}

function maybeB64(s: string): string {
  if (!s) return s;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(s) || s.length < 4 || s.length % 4 !== 0) return s;
  try {
    const bin = atob(s);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (/^[\x20-\x7E\u00A0-\uFFFF]+$/.test(decoded)) return decoded;
    return s;
  } catch {
    return s;
  }
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm break-words">{children}</div>
    </div>
  );
}

function MessageRenderer({ typeUrl, value }: { typeUrl: string; value: any }) {
  // Pretty render for known types
  if (typeUrl.endsWith("MsgSend")) {
    return (
      <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2 text-sm">
        <Field label="From" mono link={value.fromAddress} />
        <Field label="To" mono link={value.toAddress} />
        <Field
          label="Amount"
          value={(value.amount ?? [])
            .map((c: any) => formatAmount(c.amount, { symbol: c.denom }))
            .join(", ")}
        />
      </div>
    );
  }
  if (typeUrl.endsWith("MsgDelegate") || typeUrl.endsWith("MsgUndelegate")) {
    return (
      <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2 text-sm">
        <Field label="Delegator" mono link={value.delegatorAddress} />
        <Field label="Validator" mono linkVal={value.validatorAddress} />
        <Field
          label="Amount"
          value={
            value.amount
              ? formatAmount(value.amount.amount, { symbol: value.amount.denom })
              : "—"
          }
        />
      </div>
    );
  }
  if (typeUrl.endsWith("MsgBeginRedelegate")) {
    return (
      <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2 text-sm">
        <Field label="Delegator" mono link={value.delegatorAddress} />
        <Field label="From validator" mono linkVal={value.validatorSrcAddress} />
        <Field label="To validator" mono linkVal={value.validatorDstAddress} />
        <Field
          label="Amount"
          value={
            value.amount
              ? formatAmount(value.amount.amount, { symbol: value.amount.denom })
              : "—"
          }
        />
      </div>
    );
  }
  if (typeUrl.endsWith("MsgWithdrawDelegatorReward")) {
    return (
      <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2 text-sm">
        <Field label="Delegator" mono link={value.delegatorAddress} />
        <Field label="Validator" mono linkVal={value.validatorAddress} />
      </div>
    );
  }
  if (typeUrl.endsWith("MsgVote")) {
    return (
      <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2 text-sm">
        <Field label="Voter" mono link={value.voter} />
        <Field label="Proposal" value={`#${value.proposalId}`} />
        <Field label="Option" value={String(value.option)} />
      </div>
    );
  }
  return (
    <pre className="rounded-lg border border-border bg-muted/20 p-3 text-[11px] font-mono overflow-x-auto">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function Field({
  label,
  value,
  mono,
  link,
  linkVal,
}: {
  label: string;
  value?: string;
  mono?: boolean;
  link?: string;
  linkVal?: string;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 items-center">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`break-all ${mono ? "font-mono text-xs" : "text-sm"}`}>
        {link ? (
          <Link
            to="/accounts/$address"
            params={{ address: link }}
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            {link}
            <CopyButton value={link} />
          </Link>
        ) : linkVal ? (
          <Link
            to="/validators/$address"
            params={{ address: linkVal }}
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            {linkVal}
            <CopyButton value={linkVal} />
          </Link>
        ) : (
          value
        )}
      </div>
    </div>
  );
}
