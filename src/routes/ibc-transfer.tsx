import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/shared/ui";
import { useWallet } from "@/lib/wallet";
import { defaultNetwork } from "@/data/networks";
import { lcd, safe } from "@/lib/cosmos";
import { ibcTransfer, estimateFee, type FeeTier } from "@/lib/tx";
import { formatAmount, shorten } from "@/lib/format";
import { ArrowRight, Check, Loader2, Globe } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ibc-transfer")({
  head: () => ({
    meta: [
      { title: "IBC Transfer · Jay Network Explorer" },
      {
        name: "description",
        content: "Send JAY tokens across Cosmos zones via IBC.",
      },
    ],
  }),
  component: IbcTransferPage,
});

const PRESETS: Array<{ label: string; channel: string; prefix: string }> = [
  { label: "Cosmos Hub (channel-0)", channel: "channel-0", prefix: "cosmos" },
  { label: "Osmosis (channel-1)", channel: "channel-1", prefix: "osmo" },
];

const DECIMALS = defaultNetwork.tokenDecimals;
function toMicro(human: string): string {
  if (!human) return "0";
  const [w, f = ""] = human.split(".");
  const frac = (f + "0".repeat(DECIMALS)).slice(0, DECIMALS);
  return BigInt(w || "0") * BigInt(10 ** DECIMALS) + BigInt(frac || "0") + "";
}

function IbcTransferPage() {
  const { address, connect } = useWallet();
  const [channel, setChannel] = useState("channel-0");
  const [receiver, setReceiver] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [tier, setTier] = useState<FeeTier>("average");
  const [step, setStep] = useState<"form" | "submitting" | "done">("form");
  const [hash, setHash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const { data: bal } = useQuery({
    queryKey: ["ibc-bal", address],
    queryFn: () => safe(lcd.balance(address!)),
    enabled: !!address,
    refetchInterval: 15_000,
  });
  const available =
    bal?.balances?.find((b: any) => b.denom === defaultNetwork.denom)?.amount ?? "0";

  const fee = estimateFee(tier, 250_000);

  const submit = async () => {
    if (!address) return connect();
    if (!channel.startsWith("channel-")) return toast.error("Invalid channel");
    if (!receiver || receiver.length < 10) return toast.error("Invalid receiver");
    if (!amount || Number(amount) <= 0) return toast.error("Enter amount");
    setStep("submitting");
    setErr(null);
    try {
      const res = await ibcTransfer(
        {
          sender: address,
          receiver,
          amountUjay: toMicro(amount),
          sourceChannel: channel,
          memo,
        },
        tier,
      );
      if (res.code && res.code !== 0) throw new Error(res.rawLog || `Code ${res.code}`);
      setHash(res.transactionHash);
      setStep("done");
      toast.success("IBC transfer broadcasted");
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      setStep("done");
      toast.error("IBC transfer failed", { description: e?.message });
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-primary/15 grid place-items-center text-primary ring-2 ring-primary/30">
          <Globe className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">IBC Transfer</h1>
          <p className="text-xs text-muted-foreground">
            Send {defaultNetwork.coinDenom} across Cosmos zones via IBC channels.
          </p>
        </div>
      </div>

      <Card className="p-6">
        {step === "form" && (
          <div className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                Destination Chain (preset)
              </label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.channel}
                    type="button"
                    onClick={() => setChannel(p.channel)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-xs text-left transition",
                      channel === p.channel
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/40",
                    )}
                  >
                    <div className="font-medium">{p.label}</div>
                    <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                      receiver: {p.prefix}1…
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                Source Channel
              </label>
              <input
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                placeholder="channel-0"
                className="mt-1 w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none text-sm font-mono"
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                Receiver Address (destination chain)
              </label>
              <input
                value={receiver}
                onChange={(e) => setReceiver(e.target.value)}
                placeholder="cosmos1... / osmo1..."
                className="mt-1 w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none text-sm font-mono"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Amount ({defaultNetwork.coinDenom})
                </label>
                <span className="text-[11px] text-muted-foreground">
                  Available: {formatAmount(available)}
                </span>
              </div>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0.00"
                className="mt-1 w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none text-sm font-mono"
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Fee</label>
              <div className="mt-1 grid grid-cols-3 gap-2">
                {(["low", "average", "high"] as FeeTier[]).map((t) => {
                  const f = estimateFee(t, 250_000);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTier(t)}
                      className={cn(
                        "rounded-lg border px-2 py-2 text-xs transition text-left",
                        tier === t
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/40",
                      )}
                    >
                      <div className="capitalize font-medium">{t}</div>
                      <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
                        {formatAmount(f.raw, { precision: 6 })}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                Memo (optional)
              </label>
              <input
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none text-sm"
              />
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs space-y-1">
              <Row label="From" value={shorten(address ?? "—", 12, 8)} />
              <Row label="To" value={shorten(receiver || "—", 12, 8)} />
              <Row label="Channel" value={channel} />
              <Row label="Amount" value={`${amount || "0"} ${defaultNetwork.coinDenom}`} />
              <Row label="Network Fee" value={formatAmount(fee.raw, { precision: 6 })} />
            </div>

            <button
              onClick={submit}
              className="w-full bg-gradient-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 shadow-glow"
            >
              {address ? "Send via IBC" : "Connect Wallet"} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {step === "submitting" && (
          <div className="py-12 flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <div className="text-sm text-muted-foreground text-center">
              Approve in Keplr… broadcasting IBC packet.
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="py-6 flex flex-col items-center gap-3">
            {err ? (
              <>
                <div className="h-12 w-12 rounded-full bg-destructive/15 grid place-items-center text-destructive">
                  ✕
                </div>
                <div className="text-sm font-semibold">Transfer failed</div>
                <p className="text-xs text-muted-foreground text-center max-w-md break-words">
                  {err}
                </p>
                <button
                  onClick={() => setStep("form")}
                  className="mt-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-accent/40"
                >
                  Try again
                </button>
              </>
            ) : (
              <>
                <div className="h-12 w-12 rounded-full bg-success/15 grid place-items-center text-success">
                  <Check className="h-6 w-6" />
                </div>
                <div className="text-sm font-semibold">IBC transfer sent</div>
                {hash && (
                  <a
                    href={`/transactions/${hash}`}
                    className="text-xs font-mono text-primary hover:underline break-all text-center"
                  >
                    {hash}
                  </a>
                )}
                <button
                  onClick={() => setStep("form")}
                  className="mt-2 px-4 py-2 rounded-lg bg-gradient-primary text-primary-foreground text-sm"
                >
                  Send another
                </button>
              </>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground/90 truncate max-w-[60%] font-mono">{value}</span>
    </div>
  );
}
